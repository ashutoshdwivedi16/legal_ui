declare module "mjml-browser" {
  interface Mjml2HtmlOptions {
    fonts?: Record<string, string>;
    keepComments?: boolean;
    beautify?: boolean;
    minify?: boolean;
    validationLevel?: "strict" | "soft" | "skip";
    filePath?: string;
  }

  interface Mjml2HtmlResult {
    html: string;
    errors: Array<{
      line: number;
      message: string;
      tagName?: string;
      formattedMessage?: string;
    }>;
  }

  function mjml2html(
    mjml: string,
    options?: Mjml2HtmlOptions,
  ): Mjml2HtmlResult;

  export default mjml2html;
}

