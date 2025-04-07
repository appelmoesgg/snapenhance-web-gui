// ==UserScript==
// @name         SnapEnhance Web with GUI
// @namespace    snapenhance-web-gui
// @description  A userscript to Enhance the User experience on Snapchat Web
// @version      1.2.3
// @author       appelmoesGG,SnapEnhance
// @match        *://*.snapchat.com/web/*
// @source       https://github.com/appelmoesgg/snapenhance-web-gui
// @supportURL   https://github.com/appelmoesgg/snapenhance-web-gui/issues
// @downloadUrl  https://raw.githubusercontent.com/appelmoesgg/snapenhance-web-gui/master/snapenhanceGui.user.js
// @updateUrl    https://raw.githubusercontent.com/appelmoesgg/snapenhance-web-gui/master/snapenhanceGui.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=snapchat.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.7.9/dat.gui.min.js
// @license      GPL-3.0-only
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

/*
TODO FOR ME:
- Make this code better organized

CURRENT KNOWN BUGS:
- No typing indication is not working when "Hide Bitmoji" is off
*/

const SEversion = "1.2.3";
let snapEnhanceSettings = null;
let haveRemovedBluePopup = false;

if (!"SEversion" in localStorage){ // Save current version so we can add settings in future versions of SE (if that makes sense)
    localStorage.setItem("SEversion", SEversion);
}

if (localStorage.getItem("SEversion") != SEversion){
    localStorage.setItem("SEversion", SEversion);
}

const bc = new BroadcastChannel("settingsBroadcast");

bc.onmessage = (ev) => {
    console.log("%cSending the current settings to the Snapchat service worker! \nIf you see this message multiple times, please contact a dev", "color: #FF6F61");
    bc.postMessage(JSON.stringify(snapEnhanceSettings));
}

const baseSnapEnhanceSettings = {"Anti Unfocus Blur": false,
    "Disable Read Receipts": false,
    "Hide Bitmoji": false,
    "No Typing Indication": false,
    "No Distraction": false
};

function checkForNewSettings(){
    let settingsChanged = false;

    for (let setting in snapEnhanceSettings){
        if (!(setting in baseSnapEnhanceSettings)){
            delete snapEnhanceSettings[setting];
            settingsChanged = true;
        }
    }

    for (let setting in baseSnapEnhanceSettings){
        if (!(setting in snapEnhanceSettings)){
            snapEnhanceSettings[setting] = baseSnapEnhanceSettings[setting];
            settingsChanged = true;
        }
    }

    if (settingsChanged){
        localStorage.setItem("snapEnhanceSettings", JSON.stringify(snapEnhanceSettings));
        console.log("Reloading page to add new setting(s)...")
        location.reload()
    }
}

function loadSettings(){
    if ("snapEnhanceSettings" in localStorage){
        console.log("%cLoading settings from localStorage...", "color:rgb(0, 255, 242)");
        snapEnhanceSettings = JSON.parse(localStorage.getItem("snapEnhanceSettings"));
        checkForNewSettings();
        bc.postMessage(snapEnhanceSettings);
    } else {
        snapEnhanceSettings = baseSnapEnhanceSettings;
        bc.postMessage(snapEnhanceSettings);
    }
}

// Thanks https://stackoverflow.com/a/61511955
function waitForElm(selector) {
    if (selector.includes("wHvEy") && haveRemovedBluePopup){
        console.log("waitForElemBypass")
        return new Promise((resolve) => {resolve("alreadyremoved")})
    }

    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

//reinject the gui when the user switches to another conversation/group
var oldHref = document.location.href;
var observer = new MutationObserver(function() {
        if (oldHref != document.location.href) {
            oldHref = document.location.href;
            injectGui();
            antiDistraction();
        }
});
observer.observe(document.body, {childList: true,subtree: true});


//wait for the top bar to load then inject the GUI
function injectGui(){
    waitForElm('.k1IaM').then((elm) => {
    console.log('%c(Re)injecting gui...', "color:rgb(9, 255, 0)");
    elm.append(gui.domElement);
   });
}


function antiDistraction(){
    waitForElm("#root > div.Fpg8t > div.BL7do > div.wHvEy").then((elm) => {
        waitForElm("#root > div.Fpg8t > div.Vbjsg.WJjwl > div > div > div > div.k1IaM > div.kxqcc > button").then((elm) => {
            if (snapEnhanceSettings["No Distraction"] == true){
                if (!haveRemovedBluePopup){
                    document.getElementsByClassName("wHvEy")[0].remove();
                    haveRemovedBluePopup = true;
                }

                document.getElementsByClassName("WGPER")[0].disabled = true;
                document.getElementsByClassName("WGPER")[0].title = "No Distraction!!!";

            } else {
                document.getElementsByClassName("WGPER")[0].disabled = false;
                document.getElementsByClassName("WGPER")[0].title = "Spotlight"
            }
        })
    })
}

(function (window) {
    console.log(`%cWelcome to SnapEnhance Web v${localStorage.getItem("SEversion")}!`, "font-size: 2em; background-color: black; font-style: bold;")


    function simpleHook(object, name, proxy) {
        const old = object[name];
        object[name] = proxy(old, object);
    }
    // Bypass upload size
    Object.defineProperty(File.prototype, "size", {
        get: function () {
            return 500;
        }
    });

    // hook main window requests
    const oldWindowFetch = window.fetch;
    window.fetch = (...args) => {
        const url = args[0].url;
        if (typeof url === "string") {
            if (url.endsWith("readreceipt-indexer/batchuploadreadreceipts") && snapEnhanceSettings["Disable Read Receipts"]) {
                console.log("bypassed story read receipt");
                return new Promise((resolve) => resolve(new Response(null, { status: 200 })));
            }
        }
        return oldWindowFetch(...args);
    };
    // Injected into worker
    function workerInjected() {
        workerInjected = () => {} //function should only be called once, even if the settings get updated

        function hookPreRequest(request) {
            if (request.url.endsWith("messagingcoreservice.MessagingCoreService/SendTypingNotification") && snapEnhanceSettings["No Typing Indication"]) {
                console.log("%cbypassed typing notification using PRE", "color:rgb(0, 255, 242)");
                return null;
            }
            if (request.url.endsWith("messagingcoreservice.MessagingCoreService/UpdateConversation") && snapEnhanceSettings["Disable Read Receipts"]) {
                console.log("%cbypassed conversation read receipt", "color:rgb(0, 255, 242)");
                return null;
            }
            return request;
        }
        async function hookPostRequest(request, response) {
            if (request.headers && request.headers.get("content-type") === "application/grpc-web+proto") {
                const arrayBuffer = await response.arrayBuffer();
                response.arrayBuffer = async () => arrayBuffer;
            }

            return response

        }

        // Hook websocket (hide bitmoji)
        WebSocket.prototype.send = new Proxy(WebSocket.prototype.send, {
            apply: function (target, thisArg, argumentsList) {
                //console.log("WebSocket send", argumentsList[0]);
                if (snapEnhanceSettings["Hide Bitmoji"] == false){
                    return target.apply(thisArg, argumentsList);
                }
            }
        });
        // Hook worker web requests
        const oldFetch = fetch;
        // @ts-ignore
        // eslint-disable-next-line no-implicit-globals
        fetch = async (...args) => {
            args[0] = hookPreRequest(args[0]);
            if (args[0] == null) {
                return new Promise((resolve) => resolve(new Response(null, { status: 200 })));
            }
            const requestBody = args[0].body;
            if (requestBody && !requestBody.locked) {
                const buffer = await requestBody.getReader().read();
                args[0] = new Request(args[0], {
                    body: buffer.value,
                    headers: args[0].headers
                });
            }
            // @ts-ignore
            if (args[0].url == "https://web.snapchat.com/messagingcoreservice.MessagingCoreService/SendTypingNotification"){
                console.log("bypass typing maybe maybe???")
                return new Promise(new Response(null, { status: 200 }));
            }

            const result = oldFetch(...args);
            return new Promise(async (resolve, reject) => {
                try {
                    resolve(await hookPostRequest(args[0], await result));
                }
                catch (e) {
                    console.info("Fetch error", e);
                    reject(e);
                }
            });
        };
    }

    function askSettings(){
        bc.postMessage("Settings pls");
    }

    const oldBlobClass = window.Blob;
    window.Blob = class HookedBlob extends Blob {
        constructor(...args) {
            const data = args[0][0];
            if (typeof data === "string" && data.startsWith("importScripts")) {
                args[0][0] += ` let snapEnhanceSettings;
                                ${askSettings.toString()};
                                ${workerInjected.toString()};

                                const bc = new BroadcastChannel("settingsBroadcast");
                                bc.onmessage = (ev) => {
                                    settings = JSON.parse(ev.data);
                                    snapEnhanceSettings = settings;
                                    workerInjected();
                                };

                                askSettings();`;
                window.Blob = oldBlobClass;
            }
            super(...args);
        }
    };
    simpleHook(document, "createElement", (proxy, instance) => (...args) => {
        const result = proxy.call(instance, ...args);
        // Allow audio note and image download
        if (args[0] === "audio" || args[0] === "video" || args[0] === "img") {
            simpleHook(result, "setAttribute", (proxy2, instance2) => (...args2) => {
                result.style = "pointer-events: auto;";
                if (args2[0] === "controlsList"){
                    return;
                }
                proxy2.call(instance2, ...args2);
            });
            result.addEventListener("load", (_) => {
                result.parentElement?.addEventListener("contextmenu", (event) => {
                    event.stopImmediatePropagation();
                });
            });
            result.addEventListener("contextmenu", (event) => {
                event.stopImmediatePropagation();
            });
        }
        return result;
    });
    // Always focused - Fixed now 24/3/25 17:44
    const oldFocus = document.hasFocus();
    document.hasFocus = () => {
        if (snapEnhanceSettings["Anti Unfocus Blur"]){
            return true;
        } else {
        return oldFocus;
        }
    }


    const oldAddEventListener = EventTarget.prototype.addEventListener;
    Object.defineProperty(EventTarget.prototype, "addEventListener", {
        value: function (...args) {
            const eventName = args[0];

            if (eventName === "keydown"){
                return;
        }

            if (eventName === "focus" && snapEnhanceSettings["Anti Unfocus Blur"]){
                return;
        }

            return oldAddEventListener.call(this, ...args);
        }
    });
}(window.unsafeWindow || window));

const gui = new dat.GUI({name: "SnapEnhance WEB", autoPlace: false, closeOnTop: true})
gui.width = 300;
gui.domElement.style.zIndex = 100;
gui.domElement.style.marginTop = "auto"

loadSettings();

for (let [setting,value] of Object.entries(snapEnhanceSettings)){
    gui.add(snapEnhanceSettings, setting).onChange((val) => {
            antiDistraction();
            localStorage.setItem("snapEnhanceSettings", JSON.stringify(snapEnhanceSettings));
            bc.postMessage(JSON.stringify(snapEnhanceSettings));
        }
    );
}


antiDistraction()
injectGui();
