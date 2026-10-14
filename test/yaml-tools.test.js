// Draaien met: node --test test/
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const jsyaml = require(path.join(__dirname, "../extension/vendor/js-yaml/js-yaml.min.js"));
const PaYaml = require("../extension/src/yaml-tools.js");

const screen = `Screens:
  HomeScreen:
    Properties:
      Fill: =RGBA(255, 255, 255, 1)
      OnVisible: |-
        =Set(varA, 1);
        Set(varB, 2)
    Children:
      - Header:
          Control: GroupContainer@1.3.0
          Variant: ManualLayout
          Properties:
            Height: =64
          Children:
            - 'Title Label':
                Control: Label@2.5.1
                Properties:
                  Text: ="Hallo # wereld"
      - BtnSave:
          Control: Classic/Button@2.2.0
          Properties:
            OnSelect: =SubmitForm(Form1) # opslaan
`;

const control = `- Button1:
    Control: Classic/Button@2.2.0
    Properties:
      Text: ="Klik"
      X: =40
`;

test("outline van een scherm", () => {
  const items = PaYaml.outline(screen);
  assert.deepStrictEqual(items.map((i) => [i.name, i.type, i.depth]), [
    ["HomeScreen", "Screen", 0],
    ["Header", "GroupContainer", 1],
    ["Title Label", "Label", 2],
    ["BtnSave", "Classic/Button", 1]
  ]);
  assert.strictEqual(items[1].version, "1.3.0");
});

test("outline van een losse control", () => {
  const items = PaYaml.outline(control);
  assert.deepStrictEqual(items.map((i) => [i.name, i.type, i.depth, i.line]), [["Button1", "Classic/Button", 0, 0]]);
});

test("geldige YAML geeft geen problemen", () => {
  assert.deepStrictEqual(PaYaml.validate(screen, jsyaml), []);
  assert.deepStrictEqual(PaYaml.validate(control, jsyaml), []);
});

test("formule zonder = geeft een waarschuwing", () => {
  const p = PaYaml.validate(control.replace('="Klik"', '"Klik"'), jsyaml);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].severity, "warning");
  assert.strictEqual(p[0].line, 3);
});

test("blok-formule zonder = geeft een waarschuwing", () => {
  const p = PaYaml.validate(screen.replace("=Set(varA", "Set(varA"), jsyaml);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].line, 5);
});

test("syntaxfout wordt gemeld met regelnummer", () => {
  const broken = control.replace("    Properties:", "   Properties:");
  const p = PaYaml.validate(broken, jsyaml);
  assert.ok(p.some((x) => x.severity === "error"));
});

test("dubbele namen geven een waarschuwing", () => {
  const dup = control + control.replace(/^- /, "- ");
  const p = PaYaml.validate(dup, jsyaml);
  assert.ok(p.some((x) => /meerdere keren/.test(x.message)));
});

test("herkent Power Apps YAML", () => {
  assert.ok(PaYaml.looksLikePowerAppsYaml(screen));
  assert.ok(PaYaml.looksLikePowerAppsYaml(control));
  assert.ok(!PaYaml.looksLikePowerAppsYaml("hallo wereld"));
});
