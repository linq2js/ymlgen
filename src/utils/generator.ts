import { parse } from "yamljs";
import axios, { AxiosStatic } from "axios";
import * as zod from "zod";

export type AutoTrim = "start-end" | "all" | boolean;

export type WriteOptions = StringConvertionOptions & { autoTrim?: AutoTrim };

export type TemplateConfigs = { output: string; generator: string };

export type GenerationContext = {
  texts: string[];
  options: WriteOptions;
  data: unknown;
  axios: AxiosStatic;
  $use: Function;
  $each: Function;
  write(...values: any[]): unknown;
  configure(options: WriteOptions): void;
};

export type EachOptions = {
  separator?: TextGenerator;
};

export type TextGenerator = (
  context: GenerationContext
) => void | Promise<void>;

export type StringConvertionOptions = {};

const isDataFile = (content: string) => {
  return content.trimStart().startsWith("# ymlgen");
};

const readConfigs = (content: string) => {
  let output: string = "";
  let generator: string = "";

  content.replace(/# ymlgen:([^\s]+) ([^\n]+)/g, (_, name, value) => {
    value = value.trim();
    switch (name) {
      case "output":
        output = value;
        break;
      case "generator":
        generator = value;
        break;
      default:
        throw new Error(`Invalid config ${name}`);
    }
    return "";
  });
  if (!generator) {
    throw new Error("No ymlgen:generator config found");
  }
  if (!output) {
    throw new Error("No ymlgen:output config found");
  }
  return { output, generator };
};

const convertToString = (value: unknown, options: StringConvertionOptions) => {
  return typeof value === "undefined" || value === null ? "" : String(value);
};

const processFile = async (
  fileName: string,
  content: string,
  getGenerator: (generatorName: string) => Promise<TextGenerator>,
  writeFile: (fileName: string, content: string) => Promise<void>
) => {
  const configs = readConfigs(content);
  const isMultipleOutput = configs.output.includes("**");
  const data = parse(content);

  if (!data) {
    // invalid data
    return;
  }

  const generator = await getGenerator(configs.generator);

  if (isMultipleOutput) {
    const promises = Object.keys(data).map(async (key) => {
      const subData = data[key];
      const [fileName, generatorName] = key.split("");
      const customGenerator = generatorName
        ? await getGenerator(generatorName)
        : generator;
      const content = await generateText(subData, customGenerator);
      await writeFile(configs.output.replace("**", fileName), content);
    });
    return Promise.all(promises);
  }

  const generatedText = await generateText(data, generator);
  await writeFile(configs.output.replace("*", fileName), generatedText);
};

const generateText = async (data: unknown, generator: TextGenerator) => {
  const texts: string[] = [];
  const options: WriteOptions = {};
  const context: GenerationContext = createContext(texts, data, options);
  await generator(context);
  return texts.join("");
};

const $use = (data: unknown, generator: TextGenerator): TextGenerator => {
  return (context) =>
    generator(createContext(context.texts, data, context.options));
};

const $each = (
  data: unknown,
  generator: TextGenerator,
  options: EachOptions = {}
): TextGenerator => {
  return async (context) => {
    if (!data) {
      throw new Error(
        `$each requires object or array for rendering but got ${typeof data} `
      );
    }
    let first = true;
    for (const [key, value] of Object.entries(data as any)) {
      if (!first && options.separator) {
        await options.separator(
          createContext(context.texts, value, context.options, { key })
        );
      }
      await generator(
        createContext(context.texts, value, context.options, { key })
      );
      first = false;
    }
  };
};

const createContext = (
  texts: string[],
  data: unknown,
  options: WriteOptions,
  extraProps?: Record<string, unknown>
): GenerationContext => {
  const context = {
    ...extraProps,
    texts,
    axios,
    zod,
    data,
    options,
    $each,
    $use,
    configure(newOptions: WriteOptions) {
      Object.assign(options, newOptions);
    },
    write(...args: any[]) {
      if (args.length) {
        return (async () => {
          for (const arg of args) {
            if (typeof arg === "function") {
              await arg(context);
            } else {
              texts.push(convertToString(arg, options));
            }
          }
        })();
      }
      return async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const copyOfStrings = strings.slice();
        const next = async () => {
          if (!copyOfStrings.length) {
            return;
          }
          texts.push(copyOfStrings.shift()!);
          if (!values.length) {
            return;
          }

          let text: string;
          const value = values.shift();
          if (typeof value === "function") {
            const result = await value(context);
            text = convertToString(result, options);
          } else {
            text = convertToString(value, options);
          }
          if (options.autoTrim === "all") {
            text = text.trim();
          }
          texts.push(text);
          await next();
        };

        await next();
      };
    },
  };

  return context;
};

export { processFile, isDataFile };
