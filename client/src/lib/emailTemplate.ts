/**
 * Utilitário para geração de e-mails com a identidade visual da FATTO.
 */

interface EmailItem {
  label: string;
  value: string;
  isMono?: boolean;
}

interface EmailBox {
  title?: string;
  items: EmailItem[];
}

interface EmailTemplateOptions {
  title: string;
  description: string;
  boxes: EmailBox[];
  buttonLabel?: string;
  buttonUrl?: string;
}

export function generateEmailHtml({
  title,
  description,
  boxes,
  buttonLabel = "Acessar Autoatendimento",
  buttonUrl = "https://conatibus.fattocs.com.br/autoservico",
}: EmailTemplateOptions) {
  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const renderBox = (box: EmailBox) => `
    <div style="background-color: #f5f5f7; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      ${box.title ? `<h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px; color: #1d1d1f; font-weight: 600;">${box.title}</h3>` : ""}
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${box.items
          .map(
            (item) => `
          <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.4;">
            <span style="color: #86868b; font-weight: 400;">${item.label}:</span>
            <span style="color: ${item.isMono ? "#0071e3" : "#1d1d1f"}; font-weight: 500; ${
              item.isMono ? "font-family: monospace;" : ""
            }">
              ${item.value}
            </span>
          </li>
        `
          )
          .join("")}
      </ul>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f7; font-family: ${fontStack}; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f7; padding: 40px 20px;">
        <tr>
          <td align="center">
            <!-- Card Principal -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="padding: 30px 40px 20px 40px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="right">
                        <img src="https://www.fattocs.com/wp-content/uploads/2020/07/logo_fatto_1.png" alt="FATTO" height="66" style="display: block; height: 50pt;">
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top: 20px; border-bottom: 1px solid #d2d2d7;"></div>
                </td>
              </tr>

              <!-- Corpo Principal -->
              <tr>
                <td style="padding: 20px 40px 30px 40px;">
                  <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.015em;">
                    ${title}
                  </h1>
                  <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.5; color: #424245;">
                    ${description}
                  </p>

                  <!-- Boxes de Dados -->
                  ${boxes.map(renderBox).join("")}

                  <!-- Botão CTA -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
                    <tr>
                      <td align="center">
                        <a href="${buttonUrl}" style="background-color: #0071e3; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 980px; font-weight: 500; font-size: 16px; display: inline-block;">
                          ${buttonLabel}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Rodapé -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 30px;">
              <tr>
                <td align="center" style="padding: 0 40px; font-size: 12px; color: #86868b; line-height: 1.4;">
                  <p style="margin: 0 0 10px 0;">
                    Este é um e-mail automático gerado pelo Sistema de Gestão de Ponto da FATTO.
                    Por favor, não responda a esta mensagem.
                  </p>
                  <p style="margin: 0;">
                    &copy; ${new Date().getFullYear()} FATTO Consultoria e Sistemas. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
