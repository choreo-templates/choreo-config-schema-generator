const yaml = require("js-yaml");
const path = require("path");
const fs = require("fs");

function readComponentYaml(filePath) {
  try {
    fullPath = path.join(filePath, ".choreo", "component.yaml");
    let fileContent = fs.readFileSync(fullPath, "utf8");
    return fileContent;
  } catch (error) {
    throw new Error(`Failed to read component.yaml: ${error.message}`);
  }
}

fileContent = readComponentYaml(
  "/Users/janakas/Projects/choreo-config-schema-generator"
);
componentYamlFile = yaml.load(fileContent);

const jsonSchema = {
  $schema: "http://json-schema.org/draft-04/schema#",
  type: "object",
  properties: {},
  required: [],
};

function generateSchemaFromYaml(item, requiredItems) {
  if (item.type === "string") {
    if (!typeof item.required === "boolean" || item.required !== false) {
      requiredItems.push(item.name);
    }
    return {
      type: "string",
    };
  }

  if (item.type === "integer") {
    if (!typeof item.required === "boolean" || item.required !== false) {
      requiredItems.push(item.name);
    }
    return {
      type: "integer",
    };
  }

  if (item.type === "array") {
    if (item.items.type === "string") {
      return {
        type: "array",
        items: {
          type: "string",
        },
      };
    }
    if (item.items.type === "integer") {
      return {
        type: "array",
        items: {
          type: "integer",
        },
      };
    }
    return {
      type: "array",
      items: generateSchemaFromYaml(item.items, requiredItems),
    };
  }

  if (item.type === "object") {
    let properties = {};
    let required = [];
    if (item.properties) {
      item.properties.forEach((property) => {
        properties[property.name] = generateSchemaFromYaml(property, required);
      });
    }
    return {
      type: "object",
      properties: properties,
      required: required,
    };
  }
}

componentYamlFile.configurations.schema.forEach((item) => {
  jsonSchema.properties[item.name] = generateSchemaFromYaml(
    item,
    jsonSchema.required
  );
});

console.log(JSON.stringify(jsonSchema));
