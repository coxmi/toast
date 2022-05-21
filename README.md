

<pre>Please note: This library is a work in progress!</pre>

# toast

### A really tiny static site generator plugin for webpack

Turn external data sources into a static site without specifying your development environment. Transpile, generate, or concatenate your templates however you want, toast is just a step in your build process. You’re not tied to using today’s framework of choice, so you can use es6 template literals for your `sitemap.xml`, `jsx` for your `<head>`, or `ejs` for your `<body>`.

- bring your own transpilation (using [webpack](https://webpack.js.org/))
- just return a `string` in your template render function
- no magic filenames or frontmatter: set urls in your template files
- fetch data from anywhere: just export a `Promise` or `async` function


## Usage

```js
// use javascript to get your content from anywhere you like
export const content = { title: 'Hello, World!' }

// set the url of your page
export const url = '/'

// render your template
export const html = (content, meta) => 
  `<!DOCTYPE html>
   <html>
        <body>
            <h1>${content.title}</h1>
        </body>
    </html>`
```

## Setup

### Install

```bash
npm install toast-static --save-dev
```

### Configure webpack

Add the plugin to your `webpack.config.js`:


```js
const { WebpackToastPlugin } = require('toast-static/webpack')

module.exports = {
    output: {
        path: outputDir,
        filename: '[name].js',
    },
    plugins: [
        new WebpackToastPlugin({ 
            templates: './templates/**.js' // glob, path, or array
        })
    ]
}
```



## Templates

A template is just a simple js file with some exports. 

`pages/latest.js`:

```js
// grab your data (optional)
export const content = fetch('https://xkcd.com/info.0.json').then((res) => res.json())

// set your output url (starting with a forward-slash)
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

### Collections

Export an iterable to `collection`, and a page will be generated for each item. 

`pages/drinks.js`:

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

To split up a collection into pages, just export a number to `perPage`.

`pages/blog.js`:

```js
export const collection = [
    { url: 'hello-world' },
    { url: 'how-i-only-used-1-million-dependencies-to-build-my-new-blog' },
    { url: 'who-needs-reactjs-anyway' },
    { url: 'framework-fatigue-in-2041' },
    { url: 'ai-generated-webpack-config' },
    { url: 'the-singularity-came-from-css-houdini' }
]

// split posts into groups of five
export const perPage = 5 

// set url to "/posts" for first page, and "/posts/2" for others
export const url = (content, meta) => {
    return (meta.currentPage === 1)
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


# Template exports


| Name | Purpose | Valid signatures
| :--- | :--- | :--- |
| `html` | Outputs the page content<br>Function is passed `content` and `meta` arguments to help render the page | `async (content, meta) => string`<br>`string` |
| `url` | Sets the page url<br>Must begin with a `/`. | `async (content, meta) => string`<br>`string` |
| `content` | (optional) Use to fetch the data from anywhere<br>(result is passed to `html` function) |  `async () => any`<br>`any` |
| `collection` | (optional) Fetch a set of items<br>Each item generates a page | `async () => []`<br>`[]` |
| `perPage` | (optional) split a `collection` into chunks for pagination | `number` |


### `html` and `url` function arguments

#### `content`

`content` is the value exported by your `content` or `collection` function in the template, whichever takes precedence.

#### `meta`

`meta` is an object with the following properties:

- `url`: the pretty url returned from your `url` function (e.g. `/`)
- `output`: the path to the file created (e.g. `/index.html`)
- `outputDir`: absolute path to the output directory
- `root`: relative path from the current page to the document root
- `relative(pathFromRoot)`: returns the relative path to an asset from the current page
- `currentPage`: the current page in a collection
- `firstPage`: the first page in a collection
- `lastPage`: the last page in a collection 
- `previousPage`: the previous page in a collection 
- `nextPage`: the next page in a collection 
- `firstIndexOnPage`: the first item on the current page (counting from 0) 
- `lastIndexOnPage`: the last item on the current page (counting from 0)
- `firstItemOnPage`: the first item on the current page (counting from 1)
- `lastItemOnPage`: the first item on the current page (counting from 1)


### Page context (accessing `content` and `meta`)

Calling `context()` within your template functions gives you access to the `content` and `meta` variables, without having to pass them through each function call (including within async components, or deep within the render tree)

```js
import { context } from 'toast-static'

const { content, meta } = context()
```


# Contributing

Contributions welcome!
