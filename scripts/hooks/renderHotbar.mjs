export function renderHotbar(app, html, context) {

    // Attach a button to the right of the hotbar which allows the GM to toggle the Intelligent GM Assistant
    const toAppend =
        $(`<div id="intelligent-gm-assistant-toggle" class="bar-controls flexcol" data-tooltip-direction="UP">
            <a class="page-control" data-tooltip="Toggle Intelligent GM Assistant">
                <i class="fas fa-robot"></i>
            </a>
        </div>`);
    toAppend.on("click", onBtnClick);
    html.find("#hotbar-page-controls").after(toAppend);
}

function onBtnClick(ev) {
    ev.preventDefault();

    game.modules.get("intelligent-gm-assistant").api.launchApp();
}
