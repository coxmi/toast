
## A really tiny static site generator plugin for webpack

transpile, generate, or concatenate your templates however you want, this plugin is just a step in your build process. It’s flexible enough to use `ejs` for your `sitemap.xml`, and `jsx` for your `<head>`, and turn external data sources into a static site without specifying your development environment.

- bring your own transpilation (using [webpack](https://webpack.js.org/))
- just return a `string` in your template render function
- template-first: set urls in your template files (no magic filenames or frontmatter)
- fetch data from anywhere: just export a `Promise` or `async` function


## basic example

### config

webpack.config.js:

```js
export default {
    output: {
        path: outputDir,
        filename: '[name].js',
    }
    plugins: [
        new StaticSitePlugin({ 
            pages: './pages/**.js' 
        }),
        ...
    ]
}
```


### pages

template file, e.g. (pages/latest.js):

```js
// export your data
export const content = fetch('https://xkcd.com/info.0.json').then((res) => res.json())

// set pretty output urls
export const url = (content, meta) => '/latest/'

// render your html (or css, json, xml, rss, svg, or any other string-based format)
export const html = (content, meta) => 
    `<!DOCTYPE html>
    <html>
        <body>
            <h1>${content.title}</h1>
            <img src="${content.img}">
        </body>
    </html>`
```

### collections

export an iterable using `collection`, and a page will be created for each item.

template file, e.g. (pages/drinks.js):

```js

export const collection = fetch('https://thecocktaildb.com/api/json/v1/1/filter.php?i=Mango').then((res) => res.json())

export const url = (content, meta) => `/drinks/${content.idDrink}/`

export const html = (content, meta) => 
    `<!DOCTYPE html>
    <html>
        <body>
            <h1>${content.strDrink}</h1>
            <img src="${content.strDrinkThumb}">
        </body>
    </html>`

```

### pagination

the same as a collection, just add a `perPage` export variable.

template file, e.g. (pages/blog.js):

```js
export const collection = [
    { url: 'hello-world' },
    { url: 'how-i-only-used-1-million-dependencies-to-build-my-new-blog' },
    { url: 'who-needs-reactjs-anyway' },
    { url: 'framework-fatigue-in-2041' },
    { url: 'ai-generated-webpack-config' },
    { url: 'the-singularity-came-from-css-houdini' }
]

// split posts into chunks of five per page
export const perPage = 5 

// "/posts" for first page, and "/posts/2" for others
export const url = (content, meta) => {
    return (currentPage === 1)
        ? `/posts/`
        : `/posts/${meta.currentPage}/`
}

export const html = (content, meta) => 
    `<!DOCTYPE html>
    <html>
        <body>
            <h1>Page ${meta.currentPage} of ${meta.lastPage}</h1>
            <ul>
                ${content.map(post => 
                    `<li><a href="${post.url}">${post.url}</a></li>`
                ).join('')}
            </ul>
        </body>
    </html>`
```

