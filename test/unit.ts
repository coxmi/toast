
import test from 'ava'
import path from 'path'
import { createPage } from './../dist/pages.js'

const relative = (...paths) => path.resolve(__dirname, ...paths)
const outputDir = relative('fixtures/dist')


test('error for invalid permalink', async t => {
    try {
        const output = await createPage(outputDir, '/has-query?like=this', 'Hello, world!')    
    } catch(e) {
        e.message.includes('permalink') && t.pass()
    }
})

// test('creates page in directory', async t => {
//     const id = '1'
//     const permalink = '/one'
//     const render = () => `Hello, world!`
//     const output = await createPage(outputDir, id, permalink, render)
// })