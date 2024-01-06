export default class FileEditApp extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "intelligent-gm-assistant-file-edit-form",
            template: 'modules/intelligent-gm-assistant/templates/file-edit-app.hbs',
            classes: ["intelligent-gm-assistant", "intelligent-gm-assistant-file-edit"],
            width: 450,
            height: 'auto',
            submitOnClose: true,
        });
    }

    fileId;
    callback;

    /* -------------------------------------------- */

    constructor(id, callback, options) {
        super(options);
        this.fileId = id;
        this.callback = callback;
    }

    /* -------------------------------------------- */

    async getData(options) {
        const data = super.getData(options);

        const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping") || {};
        data.file = fileMapping[this.fileId];

        if ( !data.file.role ) data.file.role = "GAMEMASTER";
        if ( !data.file.users ) data.file.users = [];

        // Calculate a user list and if they have default access via the current role
        data.users = game.users.map(u => {
            const hasDefaultAccess = u.role >= CONST.USER_ROLES[data.file.role];
            return {
                id: u.id,
                name: u.name,
                role: u.role,
                hasDefaultAccess: hasDefaultAccess,
                hasAccess: hasDefaultAccess || (fileMapping[this.fileId].users?.includes(u.id) ?? false)
            };
        });

        return data;
    }

    /* -------------------------------------------- */

    async _updateObject(event, formData) {
        const fileMapping = game.settings.get("intelligent-gm-assistant", "fileMapping") || {};
        fileMapping[this.fileId].name = formData.name;
        fileMapping[this.fileId].role = formData.role;

        // Get the list of users who have access to this file
        const users = [];
        for (let key in formData) {
            if (key.startsWith("user-") && formData[key]) {
                users.push(key.substring(5));
            }
        }
        fileMapping[this.fileId].users = users;
        await game.settings.set("intelligent-gm-assistant", "fileMapping", fileMapping);
        this.callback();
    }

    /* -------------------------------------------- */

    activateListeners(html) {
        super.activateListeners(html);

        // When the role selector changes, update the user access list
        html.find("#role").on("change", ev => {
            const role = ev.target.value;
            const users = html.find(".user");
            for (let user of users) {
                const hasDefaultAccess = user.dataset.role >= CONST.USER_ROLES[role];
                if (user.checked && !hasDefaultAccess) {
                    user.checked = false;
                }
                else if (!user.checked && hasDefaultAccess) {
                    user.checked = true;
                }
                user.disabled = hasDefaultAccess;
            }
        });
    }
}
