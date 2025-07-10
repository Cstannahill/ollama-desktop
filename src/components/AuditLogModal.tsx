import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePermissionStore } from "../stores/permissionStore";

type Entry = {
  when: string;
  thread_id: string;
  tool: string;
  args: any;
  ok: boolean;
};

type Props = { onClose: () => void };

export default function AuditLogModal({ onClose }: Props) {
  const { currentThreadId } = usePermissionStore();
  const [logs, setLogs] = React.useState<Entry[]>([]);
  React.useEffect(() => {
    invoke<Entry[]>("get_audit_log", { threadId: currentThreadId }).then((d) => setLogs(d));
  }, [currentThreadId]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded shadow w-96">
        <h2 className="font-bold mb-2">Audit Log</h2>
        <div className="max-h-60 overflow-y-auto text-sm mb-2">
          {logs.map((l, i) => (
            <div key={i} className="border-b py-1">
              <div>{l.when}</div>
              <div>
                {l.tool} {l.ok ? "✓" : "✗"}
              </div>
            </div>
          ))}
        </div>
        <div className="text-right">
          <button className="border rounded px-3" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
