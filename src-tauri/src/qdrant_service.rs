use std::process::Stdio;
use std::time::Duration;
use tokio::time::sleep;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QdrantConfig {
    pub auto_start: bool,
    pub port: u16,
    pub use_docker: bool,
    pub data_path: Option<String>,
}

impl Default for QdrantConfig {
    fn default() -> Self {
        Self {
            auto_start: true,
            port: 6333,
            use_docker: true,
            data_path: None,
        }
    }
}

pub struct QdrantService {
    config: QdrantConfig,
    process: Option<tokio::process::Child>,
}

impl QdrantService {
    pub fn new(config: QdrantConfig) -> Self {
        Self {
            config,
            process: None,
        }
    }

    /// Check if Qdrant is running (quick health check)
    pub async fn is_running(&self) -> bool {
        let url = format!("http://127.0.0.1:{}", self.config.port);
        match reqwest::Client::new()
            .get(&url)
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    /// Start Qdrant service if it's not already running
    pub async fn ensure_running(&mut self) -> anyhow::Result<()> {
        if !self.config.auto_start {
            return Ok(());
        }

        // Check if already running
        if self.is_running().await {
            println!("✅ Qdrant already running on port {}", self.config.port);
            return Ok(());
        }

        // Try to start Qdrant
        println!("🚀 Starting Qdrant service...");
        
        if self.config.use_docker {
            self.start_docker().await
        } else {
            self.start_binary().await
        }
    }

    /// Start Qdrant using Docker
    async fn start_docker(&mut self) -> anyhow::Result<()> {
        // Check if Docker is available
        if !self.is_docker_available().await {
            println!("⚠️ Docker not available, trying to start Qdrant binary...");
            self.config.use_docker = false;
            return self.start_binary().await;
        }

        // Stop any existing Qdrant containers
        let _ = tokio::process::Command::new("docker")
            .args(&["stop", "ollama-qdrant"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .await;

        let _ = tokio::process::Command::new("docker")
            .args(&["rm", "ollama-qdrant"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .await;

        // Start new Qdrant container
        let mut cmd = tokio::process::Command::new("docker");
        cmd.args(&[
            "run",
            "--name", "ollama-qdrant",
            "--detach",
            "--restart", "unless-stopped",
            "-p", &format!("{}:6333", self.config.port),
        ]);

        // Add volume mapping if data path is specified
        if let Some(data_path) = &self.config.data_path {
            cmd.args(&["-v", &format!("{}:/qdrant/storage", data_path)]);
        }

        cmd.arg("qdrant/qdrant");

        let output = cmd.output().await?;

        if output.status.success() {
            println!("🐳 Qdrant Docker container started");
            
            // Wait for service to be ready
            self.wait_for_ready().await?;
            Ok(())
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to start Qdrant Docker container: {}", error);
        }
    }

    /// Start Qdrant using binary (if installed locally)
    async fn start_binary(&mut self) -> anyhow::Result<()> {
        // Check if qdrant binary is available
        if !self.is_binary_available().await {
            return Err(anyhow::anyhow!(
                "Qdrant binary not found. Please install Qdrant or enable Docker mode. See: https://qdrant.tech/documentation/quick_start/"
            ));
        }

        let mut cmd = tokio::process::Command::new("qdrant");
        
        // Set port if different from default
        if self.config.port != 6333 {
            cmd.env("QDRANT__SERVICE__HTTP_PORT", self.config.port.to_string());
        }

        // Set data path if specified
        if let Some(data_path) = &self.config.data_path {
            cmd.env("QDRANT__STORAGE__STORAGE_PATH", data_path);
        }

        // Start as background process
        cmd.stdout(Stdio::null())
           .stderr(Stdio::null());

        let child = cmd.spawn()?;
        self.process = Some(child);

        println!("🔧 Qdrant binary started");
        
        // Wait for service to be ready
        self.wait_for_ready().await?;
        Ok(())
    }

    /// Check if Docker is available
    async fn is_docker_available(&self) -> bool {
        match tokio::process::Command::new("docker")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .await
        {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    /// Check if Qdrant binary is available
    async fn is_binary_available(&self) -> bool {
        match tokio::process::Command::new("qdrant")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .await
        {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    /// Wait for Qdrant to be ready (up to 30 seconds)
    async fn wait_for_ready(&self) -> anyhow::Result<()> {
        println!("⏳ Waiting for Qdrant to be ready...");
        
        for attempt in 1..=15 { // 15 attempts, 2 seconds each = 30 seconds max
            if self.is_running().await {
                println!("✅ Qdrant is ready on port {}", self.config.port);
                return Ok(());
            }
            
            if attempt < 15 {
                println!("⏳ Attempt {}/15 - waiting for Qdrant...", attempt);
                sleep(Duration::from_secs(2)).await;
            }
        }

        Err(anyhow::anyhow!("Qdrant failed to start within 30 seconds"))
    }

    /// Stop the Qdrant service
    pub async fn stop(&mut self) -> anyhow::Result<()> {
        if self.config.use_docker {
            // Stop Docker container
            let output = tokio::process::Command::new("docker")
                .args(&["stop", "ollama-qdrant"])
                .output()
                .await?;

            if output.status.success() {
                println!("🛑 Qdrant Docker container stopped");
            }
        } else if let Some(ref mut process) = self.process {
            // Kill the binary process
            let _ = process.kill();
            let _ = process.wait();
            println!("🛑 Qdrant binary process stopped");
        }

        self.process = None;
        Ok(())
    }

    /// Get service status information
    pub async fn get_status(&self) -> QdrantStatus {
        let running = self.is_running().await;
        let method = if self.config.use_docker {
            if self.is_docker_available().await {
                "Docker"
            } else {
                "Docker (unavailable)"
            }
        } else {
            if self.is_binary_available().await {
                "Binary"
            } else {
                "Binary (unavailable)"
            }
        };

        QdrantStatus {
            running,
            port: self.config.port,
            method: method.to_string(),
            auto_start: self.config.auto_start,
        }
    }
}

impl Drop for QdrantService {
    fn drop(&mut self) {
        // Clean up process on drop (though we generally want it to keep running)
        if let Some(ref mut process) = self.process {
            let _ = process.kill();
        }
    }
}

#[derive(Debug, Serialize)]
pub struct QdrantStatus {
    pub running: bool,
    pub port: u16,
    pub method: String,
    pub auto_start: bool,
}

// Global instance management
use std::sync::Arc;
use tokio::sync::Mutex;

static QDRANT_SERVICE: std::sync::OnceLock<Arc<Mutex<QdrantService>>> = std::sync::OnceLock::new();

/// Initialize the global Qdrant service
pub fn init_qdrant_service(config: QdrantConfig) {
    let service = QdrantService::new(config);
    let _ = QDRANT_SERVICE.set(Arc::new(Mutex::new(service)));
}

/// Get the global Qdrant service instance
pub async fn get_qdrant_service() -> Arc<Mutex<QdrantService>> {
    QDRANT_SERVICE.get_or_init(|| {
        let service = QdrantService::new(QdrantConfig::default());
        Arc::new(Mutex::new(service))
    }).clone()
}

/// Ensure Qdrant is running (convenience function)
pub async fn ensure_qdrant_running() -> anyhow::Result<()> {
    let service = get_qdrant_service().await;
    let mut service = service.lock().await;
    service.ensure_running().await
}

/// Get Qdrant status (convenience function)
pub async fn get_qdrant_status() -> QdrantStatus {
    let service = get_qdrant_service().await;
    let service = service.lock().await;
    service.get_status().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qdrant_config_default() {
        let config = QdrantConfig::default();
        assert_eq!(config.auto_start, true);
        assert_eq!(config.port, 6333);
        assert_eq!(config.use_docker, true);
        assert!(config.data_path.is_none());
    }

    #[tokio::test]
    async fn test_qdrant_service_creation() {
        let config = QdrantConfig::default();
        let service = QdrantService::new(config);
        
        // Should be able to create service
        assert!(service.process.is_none());
    }

    #[tokio::test]
    async fn test_docker_availability_check() {
        let config = QdrantConfig::default();
        let service = QdrantService::new(config);
        
        // Should not panic when checking Docker availability
        let _available = service.is_docker_available().await;
    }

    #[tokio::test]
    async fn test_binary_availability_check() {
        let config = QdrantConfig::default();
        let service = QdrantService::new(config);
        
        // Should not panic when checking binary availability
        let _available = service.is_binary_available().await;
    }

    #[tokio::test]
    async fn test_is_running_check() {
        let config = QdrantConfig::default();
        let service = QdrantService::new(config);
        
        // Should be able to check if running (will return false if not started)
        let _running = service.is_running().await;
    }

    #[tokio::test]
    async fn test_global_service_access() {
        // Should be able to get global service instance
        let service = get_qdrant_service().await;
        let service = service.lock().await;
        let status = service.get_status().await;
        
        assert_eq!(status.port, 6333);
    }
}