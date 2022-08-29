# `ymlgen`

A generator for YML/YAML files

## Features

- Generate one or many files from YML/YAML config file
- Async rendering supported

## Requirements

1. This extension only activates when YAML language is enabled
2. Create `.ymlgen/generators` directory that locates workspace root directory
3. Create first generator file in the `generators` directory, a generator file must be javascript file (`.js`)
4. The generator might look like this:

   ```js
   const writeItem = ({ write, key, data }) => write(`<li>${key}:${data}</li>`);
   const writeSeparator = ({ write }) => write("<li>---</li>");

   // using nodejs export style
   module.exports = async (context) => {
     const { data, write } = context;
     write("Something");
   };
   ```

5. Create template file, a template file must be YML/YAML file

The template file must contain header, the header must follow the format below

```yml
# ymlgen: generatorName, *.fileExtension
```

Example:
`/yourWorkspaceDir/.ymlgen/generators/list.js`

```js
const writeItem = ({ write, key, data }) => write(`<li>${key}:${data}</li>`);
const writeSeparator = ({ write }) => write("<li>---</li>");

// using nodejs export style
module.exports = async (context) => {
  const {
    // write text to output file
    write,
    // helper
    $each,
    // the data is parsed from YML file
    data,
    // for fetching remote data purpose
    axios,
    // for schema validation purpose
    zod,
  } = context;

  // write string template
  await write()`<ul>`;
  await write(
    // data is array now, using $each helper to renders all data items
    $each(data, writeItem, { sep: writeSeparator })
  );
  // write simple value
  await write("</ul>");
};
```

`/yourWorkspaceDir/test/list.yml`

```yml
# ymlgen: list, *.html
- item1
- item2
- item3
- item4
```

After saving the yml file, `ymlgen` will create new file that locates in `/yourWorkspaceDir/test/list.html`

```html
<ul>
  <li>0:item1</li>
  <li>---</li>
  <li>1:item2</li>
  <li>---</li>
  <li>2:item3</li>
  <li>---</li>
  <li>3:item4</li>
</ul>
```

## Extension Settings

## Known Issues

## Release Notes

### 1.0.3

- Reuse private data for separated data object

  Data file

  ```yaml
  # ymlgen:output **.js

  __privateData: 1
  file1: # data for file1.js
    items:
      - 1
      - 2
      - 3
  file2: # data for file2.js
    items:
      - 4
      - 5
      - 6
  ```

  Generator file

  ```js
  module.exports = (context) => {
    console.log(context.data.__privateData); // 1
    console.log(context.data.items); // [1, 2, 3]
  };
  ```

---
