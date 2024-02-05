import API from "../../api.mjs";

export async function init() {

    // attachTempPdfMethod();

    game.settings.register("intelligent-gm-assistant", "apiKey", {
        name: "Intelligent GM Assistant API Key",
        hint: "You can get an API key by being a Patreon supporter at https://www.patreon.com/ironmoose.",
        scope: "world",
        default: "",
        config: true,
        type: String,
        requiresReload: true,
    });

    game.settings.register("intelligent-gm-assistant", "threadId", {
        scope: "user",
        default: "",
        config: false,
        type: String
    });

    game.settings.register("intelligent-gm-assistant", "threadIds", {
        scope: "world",
        default: {},
        config: false,
        type: Object
    });

    game.settings.register("intelligent-gm-assistant", "fileMapping", {
        scope: "world",
        default: {},
        config: false,
        type: Object
    });

    game.modules.get("intelligent-gm-assistant")["api"] = new API();
}

function cleanText(text) {
    // Clean out /n and /r
    text = text.replaceAll("\n", " ").replaceAll("\r", " ");

    // Clean out extra spaces
    while (text.includes("  ")) {
        text = text.replaceAll("  ", " ");
    }
    return text;
}

function attachTempPdfMethod() {
    window.journalToPdf = function(journalId) {
        const journal = game.journal.get(journalId);
        if (!journal) {
            ui.notifications.error("Journal not found");
            return;
        }

        const pageWidth = 8.5,
            lineHeight = 1.2,
            margin = 0.5,
            maxLineWidth = pageWidth - margin * 2,
            fontSize = 12,
            ptsPerInch = 72,
            oneLineHeight = (fontSize * lineHeight) / ptsPerInch;

        const doc = new jspdf.jsPDF({
            unit: "in",
            lineHeight: lineHeight,
            fontSize: fontSize,
        }).setProperties({ title: journal.name });

        let firstPage = true;

        for (let page of journal.pages) {
            if (!firstPage) doc.addPage("a4", "1");
            firstPage = false;

            // doc.html(page.text.content, {
            //     callback: function (doc) {
            //         console.log(doc);
            //         doc.save("html.pdf");
            //     },
            //     x: 10,
            //     y: 10,
            // });

            let htmlContent = page.text.content;
            // Load a DOM tree into a parser to get just the text
            let parser = new DOMParser();
            let htmlDoc = parser.parseFromString(htmlContent, "text/html");
            let textContent = htmlDoc.body.textContent.replaceAll(/\n/g, " ");

            // Replace UUID references such as @UUID[JournalEntry.k5b3J8XntDD4aDgY.JournalEntryPage.5x3UCj7aIBRhxCpk]{Cait's
            // Rest} with just the name
            textContent = textContent.replaceAll(/@UUID\[.+\]\{(.+?)\}/g, "$1");

            // Add the page title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(fontSize + 2);
            doc.text(page.name, margin, margin);

            const textLines = doc
                .setFont("helvetica", "normal")
                .setFontSize(fontSize)
                .splitTextToSize(textContent, maxLineWidth);
            doc.text(textLines, margin, margin + 2 * oneLineHeight);
        }

        doc.save(`${journal.name}.pdf`);
    }

}
