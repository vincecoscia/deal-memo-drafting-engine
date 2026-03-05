"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
  onFile: (file: File) => void;
  onFiles?: (files: File[]) => void;
  disabled?: boolean;
  selectedFile: File | null;
  selectedFiles?: File[];
  multiple?: boolean;
  onClear: () => void;
}

export function DropZone({
  onFile,
  onFiles,
  disabled,
  selectedFile,
  selectedFiles,
  multiple = false,
  onClear,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf") return "Only PDF files are accepted.";
    if (file.size > 32 * 1024 * 1024) return `${file.name} exceeds 32 MB limit.`;
    return null;
  }, []);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      setError(null);
      if (multiple && onFiles) {
        const validFiles: File[] = [];
        for (const file of Array.from(fileList)) {
          const err = validateFile(file);
          if (err) {
            setError(err);
            return;
          }
          validFiles.push(file);
        }
        onFiles(validFiles);
      } else {
        const file = fileList[0];
        if (file) {
          const err = validateFile(file);
          if (err) {
            setError(err);
            return;
          }
          onFile(file);
        }
      }
    },
    [multiple, onFile, onFiles, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const files = selectedFiles ?? (selectedFile ? [selectedFile] : []);

  if (files.length > 0) {
    return (
      <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-6">
        <div className="space-y-3">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="rounded-lg bg-accent/10 p-2">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!disabled && (
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </div>
        )}
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
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        <Upload
          className={`mx-auto mb-4 h-12 w-12 ${isDragging ? "text-accent" : "text-muted-foreground/50"}`}
        />
        <p className="text-lg font-medium text-foreground">
          Drop your PDF{multiple ? "(s)" : ""} here
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse — CIM, term sheet, or financial statement (max 32
          MB{multiple ? " each" : ""})
        </p>
      </div>
      {error && (
        <p className="mt-3 text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  );
}
