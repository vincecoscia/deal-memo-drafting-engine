"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  selectedFile: File | null;
  onClear: () => void;
}

export function DropZone({
  onFile,
  disabled,
  selectedFile,
  onClear,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(
    (file: File) => {
      setError(null);
      if (file.type !== "application/pdf") {
        setError("Only PDF files are accepted.");
        return;
      }
      if (file.size > 32 * 1024 * 1024) {
        setError("File exceeds 32 MB limit.");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validate(file);
    },
    [validate]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validate(file);
    },
    [validate]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (selectedFile) {
    return (
      <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-accent/10 p-3">
              <FileText className="h-8 w-8 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {selectedFile.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatSize(selectedFile.size)}
              </p>
            </div>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
          isDragging
            ? "border-accent bg-accent/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-accent/50 hover:bg-accent/5"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />
        <Upload
          className={`mx-auto mb-4 h-12 w-12 ${isDragging ? "text-accent" : "text-muted-foreground/50"}`}
        />
        <p className="text-lg font-medium text-foreground">
          Drop your PDF here
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse — CIM, term sheet, or financial statement (max 32
          MB)
        </p>
      </div>
      {error && (
        <p className="mt-3 text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  );
}
