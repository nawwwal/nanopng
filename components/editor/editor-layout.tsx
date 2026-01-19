"use client"

import { EditorProvider, useEditor } from "./editor-context"
import { UploadPanel } from "./upload-panel"
import { SettingsPanel } from "./settings-panel"

export function EditorLayoutInner() {
    const { hasImages } = useEditor()

    return (
        <div className="h-full w-full overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] h-full">
                {/* Left Panel - Upload/Canvas */}
                <div className="border-b-2 lg:border-b-0 lg:border-r-2 border-foreground bg-background h-full overflow-hidden flex flex-col">
                    <UploadPanel />
                </div>

                {/* Right Panel - Pitch/Settings */}
                <div className="bg-secondary h-full overflow-hidden flex flex-col">
                    <SettingsPanel />
                </div>
            </div>
        </div>
    )
}

export function EditorLayout() {
    return (
        <EditorProvider>
            <EditorLayoutInner />
        </EditorProvider>
    )
}
