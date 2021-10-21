import fetch from 'node-fetch'

export const content = fetch('https://xkcd.com/728/info.0.json').then((res) => res.json())

export const url = content => '/latest/'

export const html = content => 
    `<!DOCTYPE html>
    <html>
        <body>
            <h1>${content.title}</h1>
            <img src="${content.img}" alt="${content.alt}">
        </body>
    </html>`