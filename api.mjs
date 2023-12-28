export default class API {

    DEBUG = false;
    LOW = false;
    OUT = false;
    NEEDS_KEY = false;

    constructor() {
        this._apiKey = game.settings.get("intelligent-gm-assistant", "apiKey");
        if ( !this._apiKey ) this.NEEDS_KEY = true;
        this._baseUrl = this.DEBUG ? "http://localhost:7245/api" :
            "https://intelligentnpcs.azurewebsites.net/api";
    }

    /* -------------------------------------------- */

    getHeaders(body) {
        let headers = {
            "x-api-key": this._apiKey,
            "x-version": "1.0.0"
        };
        // If the body is not a FormData object, we set the content type to JSON
        if (!(body instanceof FormData)) headers.contentType = "application/json";
        return headers;
    }

    /* -------------------------------------------- */

    async callApi(url, body, options={
            method: "POST",
            deserializeResult: true
        })
    {

        if ( this.NEEDS_KEY ) {
            throw new Error("Set a valid API Key");
        }
        if ( this.OUT ) {
            throw new Error("Out of messages");
        }

        let params = {
            method: options.method,
            headers: this.getHeaders(body)
        };
        if ( options.method === "POST" && body ) {
            params.body = body;
        }
        const response = await fetch(this._baseUrl + url + "?code=I_ZasRU0hlvW5Q8y7zzYl4ZLnc3S8F9roA6H0I-idQuuAzFuUd5Srw==&clientId=module", params);

        // If this is a 401, the user needs to set their API key
        if ( response.status === 401 ) {
            ui.notifications.error("You need to set your Intelligent NPCs API key in the module settings.", {permanent: true});
            this.NEEDS_KEY = true;
            throw new Error("No API key");
        }

        // If this is a 403, the API key is valid but not active
        else if ( response.status === 403 ) {
            ui.notifications.error("Your Intelligent NPCs API key is not active. Please consider supporting the module on Patreon at https://www.patreon.com/ironmoose.", {permanent: true});
            this.NEEDS_KEY = true;
            throw new Error("API key not active");
        }

        // If this is a 404, the API key is not valid
        else if ( response.status === 404 ) {
            ui.notifications.error("Your Intelligent NPCs API key is invalid. Please double check your entry.", {permanent: true});
            this.NEEDS_KEY = true;
            throw new Error("Invalid API key");
        }

        // If this is a 429, we've run out of messages
        else if ( response.status === 429 ) {
            ui.notifications.error("You have run out of messages for Intelligent NPCs. Please consider supporting the module on Patreon at a higher tier for additional requests.", {permanent: true});
            this.OUT = true;
            throw new Error("Out of messages");
        }

        // If this is a 503, the API is overloaded
        else if ( response.status === 503 ) {
            ui.notifications.error("The Intelligent NPCs API is overloaded. Please try again in a short bit.");
            throw new Error("API overloaded");
        }

        // Read headers
        const remaining = response.headers.get("x-monthly-requests-remaining");
        if ( !this.LOW && remaining && (parseInt(remaining) <= 20) ) {
            this.LOW = true;
            ui.notifications.warn("You are running low on messages for Intelligent NPCs. Please consider supporting the module on Patreon at a higher tier for additional requests.", {permanent: true});
        }

        if (response.ok) {
            if (options.deserializeResult) {
                const data = await response.json();
                return data;
            }
            else {
                return;
            }
        } else {
            ui.notifications.error("Failed to call API");
            console.log(response);
        }
    }

    /* -------------------------------------------- */

    async getAccountStatus() {
        const response = await this.callApi("/AccountStatus", JSON.stringify({}), {
            method: "GET",
            deserializeResult: true
        });
        return response;
    }

    /* -------------------------------------------- */

    async createThread() {
        const response = await this.callApi("/AssistantThreadCreate", JSON.stringify({}));
        return response.id;
    }

    /* -------------------------------------------- */

    async deleteThread(threadId) {
        await this.callApi("/AssistantThreadDelete/" + threadId, JSON.stringify({}), {
            method: "POST",
            deserializeResult: false
        });
    }

    /* -------------------------------------------- */

    async getMessages(threadId) {
        const response = await this.callApi("/AssistantThreadMessages/" + threadId, JSON.stringify({}), {
            method: "GET",
            deserializeResult: true
        });
        return response.messages;
    }

    /* -------------------------------------------- */

    async addMessage(threadId, stepListener, message) {
        //console.log(message);
        await this.callApi("/AssistantThreadAddMessage/" + threadId, JSON.stringify(message), {
            method: "POST",
            deserializeResult: false
        });

        const runId = await this.createRun(threadId);
        //console.log(runId);

        let status = "in_progress";
        while ( status === "in_progress" ) {
            await new Promise(r => setTimeout(r, 2 * 1000));
            const runStatus = await this.getRunStatus(threadId, runId);
            //console.log(runStatus);
            status = runStatus.status;
            if ( stepListener ) stepListener(runStatus.step);
        }
        //console.log("Completed!");
    }

    /* -------------------------------------------- */

    async createRun(threadId) {
        const response = await this.callApi("/AssistantThreadCreateRun/" + threadId, JSON.stringify({}), {
            method: "POST",
            deserializeResult: true
        });
        return response.id;
    }

    /* -------------------------------------------- */

    async getRunStatus(threadId, runId) {
        const response = await this.callApi("/AssistantThreadGetRunStatus/" + threadId + "/" + runId, JSON.stringify({}), {
            method: "GET",
            deserializeResult: true
        });
        return response;
    }

    /* -------------------------------------------- */

    async uploadPdf(pdf) {
        const formData = new FormData();
        formData.append("file", pdf);
        // const response = await fetch(this._baseUrl + '/UploadFile', {
        //     method: 'POST',
        //     body: formData,
        //     headers: {
        //         "x-api-key": this._apiKey,
        //         "x-version": "1.0.0"
        //     }
        // });
        // const responseJson = await response.json();
        const response = await this.callApi("/UploadFile", formData, {
            method: "POST",
            deserializeResult: true
        });

        return response.id;
    }

    /* -------------------------------------------- */

    async removeFile(fileId) {
        await this.callApi("/DeleteFile/" + fileId, null, {
            method: "POST",
            deserializeResult: false
        });
    }

    /* -------------------------------------------- */

    cleanText(text) {
        // Clean out /n and /r
        text = text.replaceAll("\n", " ").replaceAll("\r", " ");

        // Clean out extra spaces
        while (text.includes("  ")) {
            text = text.replaceAll("  ", " ");
        }
        return text;
    }

    /* -------------------------------------------- */

    async journalsToPDF(journals) {
        const process = await ui.notifications.info("Processing Journals...", {permanent: false, buttons: {}});
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
        }).setProperties({ title: "All Journals" });

        let firstPage = true;

        // Build a mapping object that keeps track of what index each journal and each page is at
        let journalPageMapping = {};
        let writtenText = "";

        for (let journal of journals) {
            journalPageMapping[journal.id] = {
                startIndex: writtenText.length,
                pages: {}
            };
            for (let page of journal.pages) {
                if (!firstPage) doc.addPage("a4", "1");
                firstPage = false;

                journalPageMapping[journal.id].pages[page.id] = {
                    startIndex: writtenText.length
                }

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
                writtenText += page.name + " ";

                const textLines = doc
                    .setFont("helvetica", "normal")
                    .setFontSize(fontSize)
                    .splitTextToSize(textContent, maxLineWidth);
                doc.text(textLines, margin, margin + 2 * oneLineHeight);
                writtenText += this.cleanText(textLines.join(" ") + " ");

                journalPageMapping[journal.id].pages[page.id].endIndex = writtenText.length;
            }
            journalPageMapping[journal.id].endIndex = writtenText.length;
            journalPageMapping[journal.id].name = journal.name;
        }
        journalPageMapping.writtenText = writtenText;

        //console.log(journalPageMapping);
        //doc.save(`Journals.pdf`);

        // Upload to the API
        const fileId = await game.modules.get("intelligent-gm-assistant")["api"].uploadPdf(doc.output("blob"));
        // console.log(fileId);
        const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping");
        fileMapping[fileId] = journalPageMapping;
        game.settings.set("intelligent-gm-assistant", "fileMapping", fileMapping);
    }

    /* -------------------------------------------- */

    searchFiles(quote) {
        quote = this.cleanText(quote);
        const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping");
        const files = Object.keys(fileMapping);
        let matched = {
            journalId: null,
            pageId: null,
        };
        for (let file of files) {
            const journalPageMapping = fileMapping[file];
            let quoteIndex = journalPageMapping.writtenText.indexOf(quote);
            if ( quoteIndex === -1 ) {
                // try again without commas
                //console.log("Trying again without commas");
                quoteIndex = journalPageMapping.writtenText.replaceAll(",", "").indexOf(quote);

                // Count the number of commas before the quote
                const commasBeforeQuote = journalPageMapping.writtenText.substring(0, quoteIndex + quote.length).match(/,/g)?.length ?? 0;
                quoteIndex += commasBeforeQuote;
            }
            if ( quoteIndex === -1 ) {
                continue;
            }
            //console.log(quoteIndex);
            const journalId = Object.keys(journalPageMapping).find(journalId => {
                const journal = journalPageMapping[journalId];
                return quoteIndex >= journal.startIndex && quoteIndex <= journal.endIndex;
            });
            const pageId = Object.keys(journalPageMapping[journalId].pages).find(pageId => {
                const page = journalPageMapping[journalId].pages[pageId];
                return quoteIndex >= page.startIndex && quoteIndex <= page.endIndex;
            });
            matched = {
                journalId: journalId,
                pageId: pageId,
            };
            break;
        }
        //console.log(matched);
        return matched;
    }
}
