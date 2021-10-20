#toast

## A really tiny static site generator plugin for webpack

transpile, generate, or concatenate your templates however you want, toast is just a step in your build process. It’s flexible enough to use `ejs` for your `sitemap.xml`, and `jsx` for your `<head>`, and turn external data sources into a static site without specifying your development environment.

- bring your own transpilation (using [webpack](https://webpack.js.org/))
- just return a `string` in your template render function
- template-first: set urls in your template files (no magic filenames or frontmatter)
- fetch data from anywhere: just export a `Promise` or `async` function


## Setup

Install `toast`:

```bash
npm install toast-static --save-dev
```

### Configure webpack

Add the plugin to your `webpack.config.js`, and set the `pages` option to point to your template files (use a path, glob, or array).


```js
const ToastPlugin = require('toast-static')

module.exports = {
    output: {
        path: outputDir,
        filename: '[name].js',
    }
    plugins: [
        new ToastPlugin({ 
            pages: './pages/**.js' 
        }),
        ...
    ]
}
```

## Templates

A template is a simple js file that exports a set of properties:

Export name | Valid signatures | Use |
:--- | :--- | :---
`html` | `function => string` |  Render the page content
`url` | `string|function => string` | Set the page url
`content`<br>(optional) | `function|Promise` | Fetch data. This function's return value is passed to `html` when the page is rendered.
`collection`<br>(optional) | `function|Promise => []` | Fetch a set of items. Each item is passed to the `html` function in turn to generate a set of pages.
`perPage`<br>(optional) | `number` |  split a `collection` into chunks of a certain size, for pagination.


### Single page

Example template `pages/latest.js`:

```js
// export your data
export const content = fetch('https://xkcd.com/info.0.json').then((res) => res.json())

// set your output url
export const url = '/latest/'

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

### Collections

Export an iterable to `collection`, and a page will be generated for each item. 

Example template `pages/drinks.js`:

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

### Pagination

the same as a collection, just export an integer to `perPage`.

Example template `pages/blog.js`:

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


## Function arguments

The `html` and `url` functions are passed information to help with rendering your templates:

#### `content`
The value exported by `content` or `collection`

#### `meta`

`output` `outputDir` `relativeRoot`
`currentPage` `firstPage` `lastPage` `previousPage` `nextPage` `firstIndexOnPage` `lastIndexOnPage` `firstItemOnPage` `lastItemOnPage` 

#####Caveats:

- When a collection is exported, only the `collection` export is passed to the `html` and `url` functions (the exported value from `content` is ignored)


