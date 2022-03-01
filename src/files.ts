
import fs from 'fs-extra'
import path from 'path'


export async function createFile(outputDir: string, filePath: string, source: string) {

    const pageDir = path.dirname(filePath)
    const hasSource = source !== undefined && source !== '';

    if (!hasSource) 
        throw new Error(`No source sent for file ${path.relative(outputDir, filePath)}`)

    await fs.ensureDir(pageDir).catch(err => {
        if (err.code === 'EEXIST') {
            throw new Error(`Can't create folder "${path.relative(outputDir, pageDir)}" for file "${path.relative(outputDir, filePath)}" because a file with the same name already exists in its path — ensure your permalinks do not cause conflicts, or clear the output directory to remove conflicting files`)
        }
    })

    if (await isDir(filePath)) 
        throw new Error(`Attempted to overwrite directory "${path.relative(outputDir, filePath)}" with an output file — add an extension to your permalink, or clear the output directory to remove conflicting files`)

    try {
        await fs.outputFile(filePath, source)
        return true
    } catch(e) {
        return false
    }
}


export async function canWrite(file): Promise<boolean> {
    
    if (!path.isAbsolute(file)) 
        throw new Error(`"file" must be an absolute path`)

    let current = file
    let stats = false

    while (!stats) {
        const stats = await (fs.stat(current)).catch(() => false)
        if (!stats) {
            current = path.dirname(current)
            continue
        }
        try {
          await fs.access(current, fs.W_OK)
          return true
        } catch {
          return false
        }
    }
}

async function isDir(file: string): Promise<boolean> {
    let isDirectory = false
    try { isDirectory = (await fs.stat(file)).isDirectory() } 
    catch { isDirectory = false }
    return isDirectory
}

