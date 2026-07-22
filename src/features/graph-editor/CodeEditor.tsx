'use client';

import { useRef } from 'react';
import { display, type UnknownRecord } from '../../utils/records';

interface CodeEditorProps {
  language: string;
  value: string;
  inputs: UnknownRecord[];
  outputs: UnknownRecord[];
  onChange: (next: string) => void;
}

/**
 * Line-numbered code editor for RESULT script nodes. Input and output chips
 * insert the correct reference for the selected language, wiring the declared
 * "variables a considerar" (inputs) to the artifact's result/output contract.
 */
export function CodeEditor({ language, value, inputs, outputs, onChange }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isPython = language.toUpperCase() === 'PYTHON';
  const lineCount = Math.max(value.split('\n').length, 1);
  const gutter = Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');

  function inputReference(code: string): string {
    return isPython ? `variables["${code}"]` : `variables.${code}`;
  }

  function outputReference(code: string): string {
    return isPython ? `result["${code}"] = ` : `${code}: `;
  }

  function insertAtCursor(snippet: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + snippet);
      return;
    }
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + snippet.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  return (
    <div>
      <div className="code-editor-chips">
        {inputs.map((input) => {
          const code = display(input, 'code');
          return (
            <button
              type="button"
              key={`in-${code}`}
              title={`Insertar entrada ${code}`}
              onClick={() => insertAtCursor(inputReference(code))}
            >
              {code}
            </button>
          );
        })}
        {outputs.map((output) => {
          const code = display(output, 'code');
          return (
            <button
              type="button"
              className="output-chip-code"
              key={`out-${code}`}
              title={`Insertar salida ${code}`}
              onClick={() => insertAtCursor(outputReference(code))}
            >
              {code}
            </button>
          );
        })}
      </div>
      <div className="code-editor">
        <div className="code-editor-gutter" aria-hidden="true">
          {gutter}
        </div>
        <textarea
          ref={textareaRef}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Código ${language}`}
        />
      </div>
    </div>
  );
}
