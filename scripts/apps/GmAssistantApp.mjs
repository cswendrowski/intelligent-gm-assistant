import FileEditApp from "./FileEditApp.mjs";

export default class GmAssistantApp extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "intelligent-gm-assistant",
            template: 'modules/intelligent-gm-assistant/templates/gm-assistant-app.hbs',
            classes: ["intelligent-gm-assistant"],
            width: 800,
            height: 800,
            resizable: false,
            minimizable: true,
            title: "Intelligent GM Assistant",
            dragDrop: [{dropSelector: "#iga-files"}],
        });
    }

    messages = [];
    disabled = false;
    canUpload = true;

    /* -------------------------------------------- */

    async getData(options) {
        const data = super.getData(options);

        const accountStatus = await game.modules.get("intelligent-gm-assistant").api.getAccountStatus();
        const maxAllowedFiles = accountStatus.maxGmAssistantFiles;

        const threadIds = game.settings.get("intelligent-gm-assistant", "userThreadIds");
        const threadId = threadIds[game.world.id];

        const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping") || {};

        // If any files don't have a name, set it to File + index
        for (let f of Object.keys(fileMapping)) {
            if (!fileMapping[f].name) {
                fileMapping[f].name = `File ${Object.keys(fileMapping).indexOf(f) + 1}`;
            }
        }
        game.settings.set("intelligent-gm-assistant", "fileMapping", fileMapping);

        // Tranform into an array of objects
        const visibilityIcons = {
            "GAMEMASTER": "fas fa-eye-slash",
            "ASSISTANT": "fas fa-user-shield",
            "TRUSTED": "fas fa-user-check",
            "PLAYER": "fas fa-globe",
        };
        const keysToSkip = ["writtenText", "name", "role", "users", "permissions"];
        const fileMappingArray = Object.keys(fileMapping).map( (k, i) => {
            if ( game.user.role < CONST.USER_ROLES[fileMapping[k].role] && !fileMapping[k].users?.includes(game.user.id)) return null;
            return {
                "id": k,
                "name": fileMapping[k].name,
                "visibility": visibilityIcons[fileMapping[k].role],
                "role": fileMapping[k].role,
                "journals": Object.keys(fileMapping[k]).filter(j => !keysToSkip.includes(j)).map(j => {
                    return {
                        "id": j,
                        "name": fileMapping[k][j].name,
                        "isCompendium": fileMapping[k][j].isCompendium,
                        "pack": fileMapping[k][j].pack,
                    }
                })
            }
        }).filter(f => f !== null);
        //console.log(fileMappingArray);
        data.files = fileMappingArray;
        data.uploadedFiles = Object.keys(fileMapping).length;
        data.maxFiles = data.files.length >= maxAllowedFiles;
        data.maxAllowedFiles = maxAllowedFiles;
        data.isGm = game.user.isGM;
        this.canUpload = game.user.isGM && !data.maxFiles;

        try {
            const threadMessages = await game.modules.get("intelligent-gm-assistant").api.getMessages(threadId);

            // Translate each message's text content to parse markdown into html
            //const turndownService = new TurndownService();
            const converter = new showdown.Converter()
            for (let m of threadMessages) {
                for (let c of m.content) {
                    if (c.text) {
                        c.text.value = converter.makeHtml(c.text.value);

                        // Enrich annotations with tooltips and journal links
                        for (let a of c.text.annotations) {
                            //console.log(a);
                            const citationText = a.text;
                            let quote = a.fileCitation.quote;
                            const matched = game.modules.get("intelligent-gm-assistant").api.searchFiles(quote);

                            // Truncate the quote if it's too long
                            const maxQuoteLength = 1000;
                            if (quote.length > maxQuoteLength) {
                                quote = quote.substring(0, maxQuoteLength) + "...";
                            }
                            const citationTextWithoutBrackets = citationText.substring(1, citationText.length - 1);
                            //quote = await TextEditor.enrichHTML(quote, {links: true});
                            const pageLink = matched?.journalId ? `<a data-action="openPage" data-id="${matched.journalId}" data-pageId="${matched.pageId}"><i class="fas fa-book-open" ></i></a> ` : "";
                            const citationReplacement = `<span class="citation" data-tooltip="${quote}">【${pageLink}${citationTextWithoutBrackets}】</span>`;
                            c.text.value = c.text.value.replaceAll(citationText, citationReplacement);
                        }

                        // Find any 【13†source】 remaining and remove them
                        c.text.value = c.text.value.replaceAll(/【\d+†\w+】/g, "");

                        // Might also be of the form 【20:7†source】
                        c.text.value = c.text.value.replaceAll(/【\d+:\d+†\w+】/g, "");
                    }
                }
            }

            // // If the last message is from the user, remove the user id message
            // const lastUserMessage = threadMessages[threadMessages.length - 1];
            // if (threadMessages.length > 0 &&
            //     lastUserMessage.role === "user" &&
            //     lastUserMessage.content[0]?.text?.value === this.messages.find(m => m.id === "user")?.content[0]?.text?.value
            //     ) {
            //     this.messages = this.messages.filter(m => m.id !== "user");
            // }

            data.messages = [
                {
                    "id": foundry.utils.randomID(),
                    "role": "system",
                    "content": [{
                        "text": {
                            "value": "Hello, I am your Intelligent GM Assistant. Feel free to ask me any questions about your loaded content."
                        }
                    }],
                    "created_at": Date.now() / 1000
                },
                ...threadMessages.reverse(),
                ...this.messages
            ];

            data.messages = data.messages.filter(m => m.content[0]?.text?.value !== "");

            //console.log(data.messages);
        }
        catch (e) {
            data.messages = [
                {
                    "id": foundry.utils.randomID(),
                    "role": "system",
                    "content": [{
                        "text": {
                            "value": `Got an error while trying to load messages: ${e}`
                        }
                    }]
                }
            ];
        }
        return data;
    }

    /* -------------------------------------------- */

    /**
     * Disable the ability to interact while waiting on an action
     */
    disableInteraction(reason="Waiting...") {
        this.disabled = true;

        // Gray out and disable the chat input
        const chatInput = this._element.find("#iga-chat-input");
        chatInput.attr("disabled", true);
        chatInput.css("background-color", "#eee");
        chatInput.attr("placeholder", reason);

        // Disable the reset button
        const resetButton = this._element.find("#iga-chat-reset");
        resetButton.attr("disabled", true);
        resetButton.css("background-color", "#eee");

        // Disable the file upload dropzone
        const fileUploadDropzone = this._element.find("#iga-files");
        fileUploadDropzone.attr("disabled", true);

        // Update the text of the files dropzone
        const fileUploadDropzoneText = this._element.find("#iga-files-dropzone-text");
        fileUploadDropzoneText.text(reason);
    }

    /* -------------------------------------------- */

    activateListeners(html) {
        super.activateListeners(html);
        this.disabled = false;

        html.find('a').click(ev => {
            ev.preventDefault();
            this._handleLinkClick(ev);
        });

        html.find("#iga-chat-reset").click(this._handleResetClick.bind(this));

        // Find the messages container and scroll to the bottom
        const messageList = html.find('#iga-chat-messages');
        messageList.scrollTop(messageList[0].scrollHeight);

        // Attach a listener to the chat input
        const chatInput = html.find('#iga-chat-input');
        if ( this.messages.includes(m => m.id === "thinking") ) {
            chatInput.attr("disabled", true);
        }
        else {
            chatInput.focus();
        }
        chatInput.on('keydown', this.onKeydown(html, chatInput));
        this._contextMenu(html);
    }

    /* -------------------------------------------- */

    _contextMenu(html) {
        // Attach a context menu to the chat messages
        ContextMenu.create(this, html, ".message", [
            {
                name: "Sent to Chat",
                icon: '<i class="fas fa-comment"></i>',
                condition: li => li.hasClass("assistant"),
                callback: li => {
                    ChatMessage.create({
                        user: game.user.id,
                        speaker: ChatMessage.getSpeaker({alias: "Intelligent GM Assistant"}),
                        content: li.find(".message-content")[0].innerHTML,
                        type: CONST.CHAT_MESSAGE_TYPES.OOC,
                    });
                }
            }]);
    }

    /* -------------------------------------------- */

    async _onDrop(event) {
        if (this.disabled || !this.canUpload) return;
        this.disableInteraction();

        event.preventDefault();
        event.stopPropagation();

        //console.dir(event);

        if (event.dataTransfer.types.includes("text/plain")) {
            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            //console.dir(data);

            switch (data.type) {
                case "JournalEntry":
                    await this._handleJournalDrop(data);
                    break;
                case "Folder":
                    await this._handleFolderDrop(data);
                    break;
                case "Compendium":
                    await this._handleCompendiumDrop(data);
            }
        }
        else if (event.dataTransfer.files.length > 0) {
            const files = Array.from(event.dataTransfer.files);
            //console.dir(files);
            const pdfs = files.filter(f => f.type === "application/pdf");
            if (pdfs.length > 0) {
                for (const pdf of pdfs) {
                    const fileId = await game.modules.get("intelligent-gm-assistant")["api"].uploadPdf(pdf);
                    // console.log(fileId);
                    const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping");
                    fileMapping[fileId] = {};
                    fileMapping[fileId].name = pdf.name.replace(".pdf", "")
                        .replaceAll("_", " ").replaceAll("-", " ");
                    fileMapping[fileId].role = "GAMEMASTER";
                    game.settings.set("intelligent-gm-assistant", "fileMapping", fileMapping);
                }
            }
        }

        this.render(true);
    }

    /* -------------------------------------------- */

    async _handleResetClick(ev) {
        const threadIds = game.settings.get("intelligent-gm-assistant", "userThreadIds");
        const currentThreadId = threadIds[game.world.id];
        if (currentThreadId) {
            const confirm = await Dialog.confirm({
                title: "Reset Conversation",
                content: "Are you sure you want to reset the conversation? This will delete all messages in the conversation.",
            });
            if (!confirm) return;
            this.disableInteraction();
            await game.modules.get("intelligent-gm-assistant").api.deleteThread(currentThreadId);
        }
        const newThreadId = await game.modules.get("intelligent-gm-assistant").api.createThread();
        let currentThreadIds = game.settings.get("intelligent-gm-assistant", "userThreadIds");
        currentThreadIds[game.world.id] = newThreadId;
        await game.settings.set("intelligent-gm-assistant", "userThreadIds", currentThreadIds);
        // Wait for the thread to be created before resetting the messages
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.messages = [];
        this.render(true);
    }

    /* -------------------------------------------- */

    async _handleJournalDrop(data) {
        const journalId = data.uuid;
        const journal = await fromUuid(journalId);
        await game.modules.get("intelligent-gm-assistant").api.journalsToPDF([journal]);
    }

    /* -------------------------------------------- */

    async _handleFolderDrop(data) {
        const folderId = data.uuid;
        const folder = await fromUuid(folderId);
        const journals = [];
        const visitFolder = (folder) => {
            for (const content of folder.contents) {
                if (content.documentName === "JournalEntry") {
                    journals.push(content);
                }
            }
            for (const child of folder.children) {
                visitFolder(child.folder);
            }
        }
        visitFolder(folder);
        await game.modules.get("intelligent-gm-assistant").api.journalsToPDF(journals, folder.name);
    }

    /* -------------------------------------------- */

    async _handleCompendiumDrop(data) {
        const compendiumId = data.id;
        const compendium = game.packs.get(compendiumId);
        console.dir(compendium);
        if ( !compendium.metadata.type === "JournalEntry" ) return;
        const entries = await compendium.getDocuments();
        await game.modules.get("intelligent-gm-assistant").api.journalsToPDF(entries, compendium.metadata.label, compendium.metadata.id);
    }

    /* -------------------------------------------- */

    _handleLinkClick(ev) {
        const action = ev.currentTarget.dataset.action;
        const id = ev.currentTarget.dataset.id;

        switch (action) {
            case "editFile": return this._editFile(id);
            case "removeFile": return this._removeFile(id);
            case "openPage": return this._openPage(id, ev.currentTarget.dataset.pageid);
        }
    }

    /* -------------------------------------------- */

    async _openPage(journalId, pageId) {
        game.journal.get(journalId).sheet._render(true).then(() => {
            game.journal.get(journalId).sheet.render(true, {pageId: pageId});
        });
    }

    /* -------------------------------------------- */

    async _editFile(id) {
        // Open the File Edit application
        const fileEditApp = new FileEditApp(id, () => this.render(true));
        fileEditApp.render(true);
    }

    /* -------------------------------------------- */

    async _removeFile(id) {
        const confirm = await Dialog.confirm({
            title: "Remove File",
            content: "Are you sure you want to remove this file? Your assistant will no longer be able to reference it unless you re-add it.",
        });
        if (!confirm) return;
        this.disableInteraction();
        await game.modules.get("intelligent-gm-assistant").api.removeFile(id);
        const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping");
        delete fileMapping[id];
        await game.settings.set("intelligent-gm-assistant", "fileMapping", fileMapping);
        this.render(true);
    }

    /* -------------------------------------------- */

    onKeydown(html, chatInput) {
        return async ev => {
            if (ev.keyCode === 13 && !ev.shiftKey) {
                this.disableInteraction();
                ev.preventDefault();
                ev.stopPropagation();

                // Grab the current value, then clear the textfield
                const message = chatInput.val();
                chatInput.val('');

                // Render the message via handlebars template
                let template = "/modules/intelligent-gm-assistant/templates/assistant-message.hbs";
                let userMessageHtml = await renderTemplate(template, {
                    "id": "user",
                    "role": "user",
                    "content": [{
                        "text": {
                            "value": message
                        }
                    }],
                    "created_at": Date.now() / 1000
                });
                let userMessageElement = $(userMessageHtml);

                const chatMessages = html.find('#iga-chat-messages');
                chatMessages.append(userMessageElement);


                let thinkingMessageHtml = await renderTemplate(template, {
                    "id": "thinking",
                    "role": "system",
                    "content": [{
                        "text": {
                            "value": `<i class="fas fa-spinner fa-spin"></i> Thinking...`
                        }
                    }],
                    "created_at": Date.now() / 1000
                });
                let thinkingMessageElement = $(thinkingMessageHtml);
                chatMessages.append(thinkingMessageElement);

                // Add the message to the list
                // this.messages.push({
                //     "id": "user",
                //     "role": "user",
                //     "content": [{
                //         "text": {
                //             "value": message
                //         }
                //     }],
                //     "created_at": Date.now() / 1000
                // });
                //
                // this.messages.push({
                //     "id": "thinking",
                //     "role": "system",
                //     "content": [{
                //         "text": {
                //             "value": `<i class="fas fa-spinner fa-spin"></i> Thinking...`
                //         }
                //     }],
                //     "created_at": Date.now() / 1000
                // });
                //
                // this.render(true);

                const threadIds = game.settings.get("intelligent-gm-assistant", "userThreadIds");
                const threadId = threadIds[game.world.id];
                const updateThinkingMessage = (currentStep) => {
                    const stepToMessage = {
                        "": "Thinking...",
                        "tool_calls": "Consulting attached Resources...",
                        "message_creation": "Responding...",
                        "completed": "Responding...",
                    }
                    thinkingMessageElement.find(".message-content")[0].innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${stepToMessage[currentStep]}`;
                }
                const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping");
                const visibleFiles = Object.keys(fileMapping).filter(f => game.user.role >= CONST.USER_ROLES[fileMapping[f].role] || fileMapping[f].users?.includes(game.user.id));
                game.modules.get("intelligent-gm-assistant").api.addMessage(threadId, updateThinkingMessage, {
                    "role": "user",
                    "content": message,
                    "file_ids": visibleFiles ? visibleFiles : [],
                }).then(() => {
                    this.messages = [];
                    userMessageElement.remove();
                    thinkingMessageElement.remove();
                    this.render(true);
                });

                return false;
            }
        };
    }
}
