# `ymlgen`

A generator for YML/YAML files

## Features

- Generate one or many files from YML/YAML config file

## Requirements

1. This extension only activates when YAML language is enabled
2. Create `.ymlgen/generators` directory that locates workspace root directory
3. Create first generator file in the `generators` directory, a generator file must be javascript file (`.js`)
4. The generator might look like this:

   ```js
   const writeItem = ({ write, key, data }) => write(`<li>${key}:${data}</li>`);
   const writeSeparator = ({ write }) => write("<li>---</li>");

   globalThis.defineGenerator(async (context) => {
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
       $each(data, writeItem, { separator: writeSeparator })
     );
     // write simple value
     await write("</ul>");
   });
   ```

5. Create template file, a template file must be YML/YAML file

The template file must contain header, the header must follow the format below

```yml
# ymlgen: generatorName, *.fileExtension
```

Example:
`/yourWorkspaceDir/.ymlgen/generators/list.js`

```js
globalThis.defineGenerator(async ({ write, data }) => {
  await write("<ul>");
  for (const item of data) {
    await write(`<li>${item}</li>`);
  }
  await write("</ul>");
});
```

`/yourWorkspaceDir/test/list.yml`

```yml
# ymlgen: list, *.html
- item1
- item2
- item3
- item4
```

After saving the yml, ymlgen will create new file that locates in `/yourWorkspaceDir/test/list.html`

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

- No imports supported

## Release Notes

---
