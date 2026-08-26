export const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "two-pairs-of-eyes/stops.schema.json",
  "title": "Two Pairs of Eyes - stops data",
  "type": "object",
  "required": ["stops"],
  "additionalProperties": false,
  "properties": {
    "stops": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/stop" }
    },
    "endOfSessionRules": {
      "type": "array",
      "items": { "$ref": "#/$defs/endOfSessionRule" },
      "default": []
    }
  },
  "$defs": {
    "position": {
      "type": "object",
      "required": ["x", "y", "z"],
      "additionalProperties": false,
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" },
        "z": { "type": "number" }
      }
    },
    "stop": {
      "type": "object",
      "required": ["id", "title", "location", "hazard", "supervisor", "actions", "learning_objective"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9_]+$" },
        "title": { "type": "string", "minLength": 1 },
        "location": { "type": "string", "minLength": 1 },
        "hazard": { "$ref": "#/$defs/hazard" },
        "supervisor": { "$ref": "#/$defs/supervisor" },
        "alexStartPosition": { "$ref": "#/$defs/position" },
        "alexTargetPosition": { "$ref": "#/$defs/position" },
        "actions": {
          "type": "object",
          "minProperties": 2,
          "additionalProperties": { "$ref": "#/$defs/action" }
        },
        "flags_on_failure": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "default": []
        },
        "learning_objective": { "type": "string", "minLength": 1 }
      }
    },
    "hazard": {
      "type": "object",
      "required": ["present"],
      "additionalProperties": false,
      "properties": {
        "present": { "type": "boolean" },
        "type": { "type": "string", "minLength": 1 },
        "subtype": { "type": "string", "minLength": 1 },
        "severity": { "type": "string", "enum": ["low", "moderate", "severe"] }
      },
      "if": { "properties": { "present": { "const": true } } },
      "then": { "required": ["present", "type", "severity"] }
    },
    "supervisor": {
      "type": "object",
      "required": ["name", "behaviour", "dialogue"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "behaviour": { "type": "string", "enum": ["dismissive", "correct", "uncertain"] },
        "dialogue": { "type": "string", "minLength": 1 }
      }
    },
    "action": {
      "type": "object",
      "required": ["interaction", "points", "outcome", "consequence", "feedback"],
      "additionalProperties": false,
      "properties": {
        "interaction": { "type": "string", "minLength": 1 },
        "points": { "type": "integer", "minimum": -10, "maximum": 10 },
        "outcome": { "type": "string", "enum": ["optimal", "partial", "neutral", "failure"] },
        "consequence": { "type": "string", "minLength": 1 },
        "feedback": { "type": "string", "minLength": 1 },
        "alexAction": { "type": "string" }
      }
    },
    "endOfSessionRule": {
      "type": "object",
      "required": ["id", "requiresFlags", "consequence", "feedback"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "requiresFlags": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string", "minLength": 1 }
        },
        "consequence": { "type": "string", "minLength": 1 },
        "feedback": { "type": "string", "minLength": 1 }
      }
    }
  }
};

export default schema;
