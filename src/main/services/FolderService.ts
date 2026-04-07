import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'

export interface Folder {
  id: string
  name: string
  parentId: string | null
  color: string | null
  createdAt: string
  order: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

interface Metadata {
  folders: Folder[]
  tags: Tag[]
}

export class FolderService {
  private echoDir: string

  constructor(storageDir?: string) {
    const home = process.env.HOME || process.env.USERPROFILE || app.getPath('home')
    const rootDir = storageDir || join(home, 'Documents', 'EchoTranscripts')
    this.echoDir = join(rootDir, '.echo')
  }

  setEchoDir(rootDir: string): void {
    this.echoDir = join(rootDir, '.echo')
  }

  private get metadataPath(): string {
    return join(this.echoDir, '_metadata.json')
  }

  loadMetadata(): Metadata {
    try {
      if (existsSync(this.metadataPath)) {
        const data = readFileSync(this.metadataPath, 'utf-8')
        const parsed = JSON.parse(data)
        return {
          folders: Array.isArray(parsed.folders) ? parsed.folders : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : []
        }
      }
    } catch {
      // Corrupted file — return empty
    }
    return { folders: [], tags: [] }
  }

  private saveMetadata(data: Metadata): void {
    writeFileSync(this.metadataPath, JSON.stringify(data, null, 2), 'utf-8')
  }

  // --- Folder CRUD ---

  createFolder(name: string, parentId: string | null): Folder {
    const meta = this.loadMetadata()
    const siblings = meta.folders.filter((f) => f.parentId === parentId)
    const folder: Folder = {
      id: randomUUID(),
      name,
      parentId,
      color: null,
      createdAt: new Date().toISOString(),
      order: siblings.length
    }
    meta.folders.push(folder)
    this.saveMetadata(meta)
    return folder
  }

  renameFolder(id: string, name: string): Folder | null {
    const meta = this.loadMetadata()
    const folder = meta.folders.find((f) => f.id === id)
    if (!folder) return null
    folder.name = name
    this.saveMetadata(meta)
    return folder
  }

  deleteFolder(id: string): string[] {
    const meta = this.loadMetadata()
    // Collect all descendant folder IDs recursively
    const deletedIds: string[] = []
    const collect = (parentId: string) => {
      deletedIds.push(parentId)
      for (const child of meta.folders.filter((f) => f.parentId === parentId)) {
        collect(child.id)
      }
    }
    collect(id)
    meta.folders = meta.folders.filter((f) => !deletedIds.includes(f.id))
    this.saveMetadata(meta)
    return deletedIds
  }

  moveFolder(id: string, newParentId: string | null): Folder | null {
    const meta = this.loadMetadata()
    const folder = meta.folders.find((f) => f.id === id)
    if (!folder) return null
    // Prevent moving a folder into its own descendant
    if (newParentId !== null) {
      let check: string | null = newParentId
      while (check !== null) {
        if (check === id) return null
        const parent = meta.folders.find((f) => f.id === check)
        check = parent ? parent.parentId : null
      }
    }
    folder.parentId = newParentId
    const siblings = meta.folders.filter((f) => f.parentId === newParentId && f.id !== id)
    folder.order = siblings.length
    this.saveMetadata(meta)
    return folder
  }

  // --- Tag CRUD ---

  createTag(name: string, color: string): Tag {
    const meta = this.loadMetadata()
    const tag: Tag = { id: randomUUID(), name, color }
    meta.tags.push(tag)
    this.saveMetadata(meta)
    return tag
  }

  updateTag(id: string, name: string, color: string): Tag | null {
    const meta = this.loadMetadata()
    const tag = meta.tags.find((t) => t.id === id)
    if (!tag) return null
    tag.name = name
    tag.color = color
    this.saveMetadata(meta)
    return tag
  }

  deleteTag(id: string): void {
    const meta = this.loadMetadata()
    meta.tags = meta.tags.filter((t) => t.id !== id)
    this.saveMetadata(meta)
  }
}
