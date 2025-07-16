import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from 'sonner'

export type ProjectAttachment = {
  id: string;
  name: string;
  path: string;
  mime: string;
  size: number;
  uploadedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  attachments: ProjectAttachment[];
  chatIds: string[];
  createdAt: string;
  updatedAt: string;
  isExpanded?: boolean; // UI state for folder expansion
};

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  expandedProjects: Set<string>;
  
  // Project actions
  createProject: (name: string, description?: string) => void;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, newName: string) => Promise<void>;
  selectProject: (id: string) => void;
  
  // Project expansion
  toggleProjectExpansion: (id: string) => void;
  
  // File attachment actions
  attachFileToProject: (projectId: string, filePath: string) => Promise<void>;
  removeFileFromProject: (projectId: string, attachmentId: string) => Promise<void>;
  
  // Chat organization
  addChatToProject: (projectId: string, chatId: string) => void;
  removeChatFromProject: (projectId: string, chatId: string) => void;
  moveChatToProject: (chatId: string, fromProjectId: string | null, toProjectId: string) => void;
  
  // Data persistence
  loadProjects: () => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  expandedProjects: new Set<string>(),

  createProject: (name: string, description?: string) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project: Project = {
      id,
      name,
      description,
      attachments: [],
      chatIds: [],
      createdAt: now,
      updatedAt: now,
    };
    
    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: id,
      expandedProjects: new Set([...state.expandedProjects, id])
    }));
    
    // Save to backend
    get().saveProject(project);
    toast(`Project "${name}" created`);
  },

  deleteProject: async (id: string) => {
    try {
      await invoke("delete_project", { projectId: id });
      set((state) => {
        const newExpanded = new Set(state.expandedProjects);
        newExpanded.delete(id);
        return {
          projects: state.projects.filter(p => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
          expandedProjects: newExpanded
        };
      });
      toast("Project deleted");
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast("Failed to delete project");
    }
  },

  renameProject: async (id: string, newName: string) => {
    try {
      const project = get().projects.find(p => p.id === id);
      if (!project) return;

      const updatedProject = { 
        ...project, 
        name: newName, 
        updatedAt: new Date().toISOString() 
      };
      
      await get().saveProject(updatedProject);
      
      set((state) => ({
        projects: state.projects.map(p => p.id === id ? updatedProject : p)
      }));
      
      toast("Project renamed");
    } catch (error) {
      console.error("Failed to rename project:", error);
      toast("Failed to rename project");
    }
  },

  selectProject: (id: string) => {
    set({ currentProjectId: id });
  },

  toggleProjectExpansion: (id: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedProjects);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { expandedProjects: newExpanded };
    });
  },

  attachFileToProject: async (projectId: string, filePath: string) => {
    try {
      const attachment = await invoke<ProjectAttachment>("attach_file_to_project", {
        projectId,
        filePath
      });
      
      set((state) => ({
        projects: state.projects.map(p => 
          p.id === projectId 
            ? { ...p, attachments: [...p.attachments, attachment], updatedAt: new Date().toISOString() }
            : p
        )
      }));
      
      toast(`File "${attachment.name}" attached to project`);
    } catch (error) {
      console.error("Failed to attach file:", error);
      toast("Failed to attach file");
    }
  },

  removeFileFromProject: async (projectId: string, attachmentId: string) => {
    try {
      await invoke("remove_file_from_project", { projectId, attachmentId });
      
      set((state) => ({
        projects: state.projects.map(p => 
          p.id === projectId 
            ? { 
                ...p, 
                attachments: p.attachments.filter(a => a.id !== attachmentId),
                updatedAt: new Date().toISOString()
              }
            : p
        )
      }));
      
      toast("File removed from project");
    } catch (error) {
      console.error("Failed to remove file:", error);
      toast("Failed to remove file");
    }
  },

  addChatToProject: (projectId: string, chatId: string) => {
    set((state) => ({
      projects: state.projects.map(p => 
        p.id === projectId 
          ? { ...p, chatIds: [...p.chatIds, chatId], updatedAt: new Date().toISOString() }
          : p
      )
    }));
  },

  removeChatFromProject: (projectId: string, chatId: string) => {
    set((state) => ({
      projects: state.projects.map(p => 
        p.id === projectId 
          ? { ...p, chatIds: p.chatIds.filter(id => id !== chatId), updatedAt: new Date().toISOString() }
          : p
      )
    }));
  },

  moveChatToProject: (chatId: string, fromProjectId: string | null, toProjectId: string) => {
    set((state) => ({
      projects: state.projects.map(p => {
        if (p.id === fromProjectId) {
          return { ...p, chatIds: p.chatIds.filter(id => id !== chatId) };
        }
        if (p.id === toProjectId) {
          return { ...p, chatIds: [...p.chatIds, chatId] };
        }
        return p;
      })
    }));
  },

  loadProjects: async () => {
    try {
      const projects = await invoke<Project[]>("load_projects");
      set({ projects });
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast("Failed to load projects");
    }
  },

  saveProject: async (project: Project) => {
    try {
      await invoke("save_project", { project });
    } catch (error) {
      console.error("Failed to save project:", error);
      throw error;
    }
  },
}));
