import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type PendingAttachment = {
  name: string;
  mime: string;
  status: "processing" | "ready" | "error";
};

type Props = {
  threadId: string;
  attachments: PendingAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<PendingAttachment[]>>;
};

export default function AttachmentDropZone({ threadId, attachments, setAttachments }: Props) {
  const onDrop = useCallback(
    (files: File[]) => {
      files.forEach((f) => {
        const att: PendingAttachment = { name: f.name, mime: f.type, status: "processing" };
        setAttachments([...attachments, att]);
        invoke("attach_file", { path: (f as any).path, threadId }).catch(() => {});
      });
    },
    [attachments, setAttachments, threadId]
  );

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  useEffect(() => {
    if (!isTauri()) return;

    const unlistenPromise = listen(
      "file-progress",
      (e: { payload: { fileName: string; status: PendingAttachment["status"] } }) => {
        const { fileName, status } = e.payload;
        setAttachments((atts) =>
          atts.map((a) => (a.name === fileName ? { ...a, status } : a))
        );
      }
    );

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, [setAttachments]);

  return (
    <div {...getRootProps({ className: "p-2 border-dashed border rounded" })}>
      <input {...getInputProps()} />
      <p>Drag & drop files or click to browse</p>
    </div>
  );
}
