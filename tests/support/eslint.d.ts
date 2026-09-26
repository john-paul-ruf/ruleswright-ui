// eslint@8 ships no types; this declares only the surface tests/lint uses.
declare module 'eslint' {
  export namespace ESLint {
    interface LintMessage {
      ruleId: string | null;
      severity: 1 | 2;
      message: string;
    }
    interface LintResult {
      messages: LintMessage[];
    }
  }
  export class ESLint {
    constructor(options?: { cwd?: string });
    lintText(code: string, options?: { filePath?: string }): Promise<ESLint.LintResult[]>;
  }
}
