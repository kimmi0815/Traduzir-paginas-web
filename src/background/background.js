"use strict";

// get mimetype
var tabToMimeType = {};
chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    if (details.tabId !== -1) {
      let contentTypeHeader = null;
      for (const header of details.responseHeaders) {
        if (header.name.toLowerCase() === "content-type") {
          contentTypeHeader = header;
          break;
        }
      }
      tabToMimeType[details.tabId] =
        contentTypeHeader && contentTypeHeader.value.split(";", 1)[0];
    }
  },
  {
    urls: ["*://*/*"],
    types: ["main_frame"],
  },
  ["responseHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMainFramePageLanguageState") {
    chrome.tabs.sendMessage(
      sender.tab.id,
      {
        action: "getCurrentPageLanguageState",
      },
      {
        frameId: 0,
      },
      (pageLanguageState) => {
        checkedLastError();
        sendResponse(pageLanguageState);
      }
    );

    return true;
  } else if (request.action === "getMainFrameTabLanguage") {
    chrome.tabs.sendMessage(
      sender.tab.id,
      {
        action: "getOriginalTabLanguage",
      },
      {
        frameId: 0,
      },
      (tabLanguage) => {
        checkedLastError();
        sendResponse(tabLanguage);
      }
    );

    return true;
  } else if (request.action === "setPageLanguageState") {
    updateContextMenu(request.pageLanguageState);
  } else if (request.action === "openOptionsPage") {
    tabsCreate(chrome.runtime.getURL("/options/options.html"));
  } else if (request.action === "openDonationPage") {
    tabsCreate(chrome.runtime.getURL("/options/options.html#donation"));
  } else if (request.action === "detectTabLanguage") {
    if (!sender.tab) {
      // https://github.com/FilipePS/Traduzir-paginas-web/issues/478
      sendResponse("und");
      return;
    }
    try {
      if (
        (platformInfo.isMobile.any && !platformInfo.isFirefox) ||
        (platformInfo.isDesktop.any && platformInfo.isOpera)
      ) {
        chrome.tabs.sendMessage(
          sender.tab.id,
          { action: "detectLanguageUsingTextContent" },
          { frameId: 0 },
          (result) => sendResponse(result)
        );
      } else {
        chrome.tabs.detectLanguage(sender.tab.id, (result) => {
          checkedLastError();
          sendResponse(result);
        });
      }
    } catch (e) {
      console.error(e);
      sendResponse("und");
    }

    return true;
  } else if (request.action === "getTabHostName") {
    sendResponse(new URL(sender.tab.url).hostname);
  } else if (request.action === "thisFrameIsInFocus") {
    chrome.tabs.sendMessage(
      sender.tab.id,
      { action: "anotherFrameIsInFocus" },
      checkedLastError
    );
  } else if (request.action === "getTabMimeType") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse(tabToMimeType[tabs[0].id]);
    });
    return true;
  } else if (request.action === "restorePagesWithServiceNames") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, request, checkedLastError);
      });
    });
  } else if (request.action == "authorizationToOpenOptions") {
    chrome.storage.local.set({
      authorizationToOpenOptions: request.authorizationToOpenOptions,
    });
  }
});

function updateTranslateSelectedContextMenu() {
  if (typeof chrome.contextMenus !== "undefined") {
    chrome.contextMenus.remove("translate-selected-text", checkedLastError);
    if (twpConfig.get("showTranslateSelectedContextMenu") === "yes") {
      chrome.contextMenus.create({
        id: "translate-selected-text",
        title: twpI18n.getMessage("msgTranslateSelectedText"),
        contexts: ["selection"],
      });
    }
  }
}

function updateContextMenu(pageLanguageState = "original") {
  let contextMenuTitle;
  if (pageLanguageState === "translated") {
    contextMenuTitle = twpI18n.getMessage("btnRestore");
  } else {
    const targetLanguage = twpConfig.get("targetLanguage");
    contextMenuTitle = twpI18n.getMessage(
      "msgTranslateFor",
      twpLang.codeToLanguage(targetLanguage)
    );
  }
  if (typeof chrome.contextMenus != "undefined") {
    chrome.contextMenus.remove("translate-web-page", checkedLastError);
    chrome.contextMenus.remove(
      "translate-restore-this-frame",
      checkedLastError
    );

    if (twpConfig.get("enableIframePageTranslation") === "yes") {
      if (twpConfig.get("showTranslatePageContextMenu") == "yes") {
        chrome.contextMenus.create({
          id: "translate-web-page",
          title: contextMenuTitle,
          contexts: ["page", "frame"],
          documentUrlPatterns: [
            "http://*/*",
            "https://*/*",
            "file://*/*",
            "ftp://*/*",
          ],
        });
      }
    } else {
      if (twpConfig.get("showTranslatePageContextMenu") == "yes") {
        chrome.contextMenus.create({
          id: "translate-web-page",
          title: contextMenuTitle,
          contexts: ["page"],
          documentUrlPatterns: [
            "http://*/*",
            "https://*/*",
            "file://*/*",
            "ftp://*/*",
          ],
        });
      }

      chrome.contextMenus.create({
        id: "translate-restore-this-frame",
        title: twpI18n.getMessage("btnTranslateRestoreThisFrame"),
        contexts: ["frame"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });
    }
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason == "install") {
    tabsCreate(chrome.runtime.getURL("/options/options.html"));
    twpConfig.onReady(async () => {
      if (chrome.i18n.getUILanguage() === "zh-CN") {
        twpConfig.set("pageTranslatorService", "bing");
        twpConfig.set("textTranslatorService", "bing");
      }
    });
  } else if (
    details.reason == "update" &&
    chrome.runtime.getManifest().version != details.previousVersion
  ) {
    twpConfig.onReady(async () => {
      if (platformInfo.isMobile.any) {
        if (details.previousVersion.split(".")[0] === "9") {
          twpConfig.set("neverTranslateLangs", []);
          twpConfig.set("neverTranslateSites", []);
          twpConfig.set("alwaysTranslateLangs", []);
          twpConfig.set("alwaysTranslateSites", []);
        }
        return;
      }
      if (twpConfig.get("showReleaseNotes") !== "yes") return;
      let lastTimeShowingReleaseNotes = twpConfig.get(
        "lastTimeShowingReleaseNotes"
      );
      let showReleaseNotes = false;
      if (lastTimeShowingReleaseNotes) {
        const date = new Date();
        date.setDate(date.getDate() - 26);
        if (date.getTime() > lastTimeShowingReleaseNotes) {
          showReleaseNotes = true;
          lastTimeShowingReleaseNotes = Date.now();
          twpConfig.set(
            "lastTimeShowingReleaseNotes",
            lastTimeShowingReleaseNotes
          );
        }
      } else {
        showReleaseNotes = true;
        lastTimeShowingReleaseNotes = Date.now();
        twpConfig.set(
          "lastTimeShowingReleaseNotes",
          lastTimeShowingReleaseNotes
        );
      }
      if (showReleaseNotes) {
        tabsCreate(
          chrome.runtime.getURL("/options/options.html#release_notes")
        );
      }
    });
    twpConfig.onReady(async () => {
      translationCache.deleteTranslationCache();
    });
    twpConfig.onReady(async () => {
      twpConfig.set(
        "textTranslatorService",
        twpConfig.get("enabledServices")[0]
      );
    });
    twpConfig.onReady(async () => {
      twpConfig.set("proxyServers", {});
    });
  }

  // twpConfig.onReady(async () => {
  //   if (platformInfo.isMobile.any) {
  //     const enabledServices = twpConfig.get("enabledServices");
  //     const index = enabledServices.indexOf("deepl");
  //     if (index !== -1) {
  //       enabledServices.splice(index, 1);
  //       twpConfig.set("enabledServices", enabledServices);
  //     }
  //   }
  // });
});

function resetPageAction(tabId, forceShow = false) {
  if (!chrome.pageAction) return;
  if (twpConfig.get("translateClickingOnce") === "yes" && !forceShow) {
    chrome.pageAction.setPopup({
      popup: "",
      tabId,
    });
  } else {
    if (twpConfig.get("useOldPopup") === "yes") {
      chrome.pageAction.setPopup({
        popup: "popup/old-popup.html",
        tabId,
      });
    } else {
      chrome.pageAction.setPopup({
        popup: "popup/popup.html",
        tabId,
      });
    }
  }
}

function resetBrowserAction(forceShow = false) {
  if (twpConfig.get("translateClickingOnce") === "yes" && !forceShow) {
    chrome.action.setPopup({
      popup: "",
    });
  } else {
    if (twpConfig.get("useOldPopup") === "yes") {
      chrome.action.setPopup({
        popup: "popup/old-popup.html",
      });
    } else {
      chrome.action.setPopup({
        popup: "popup/popup.html",
      });
    }
  }
}

function sendToggleTranslationMessage(tabId) {
  if (twpConfig.get("enableIframePageTranslation") === "yes") {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "toggle-translation",
      },
      checkedLastError
    );
  } else {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "toggle-translation",
      },
      { frameId: 0 },
      checkedLastError
    );
  }
}

function sendTranslatePageMessage(tabId, targetLanguage) {
  if (twpConfig.get("enableIframePageTranslation") === "yes") {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "translatePage",
        targetLanguage,
      },
      checkedLastError
    );
  } else {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "translatePage",
        targetLanguage,
      },
      { frameId: 0 },
      checkedLastError
    );
  }
}

if (typeof chrome.contextMenus !== "undefined") {
  const updateActionContextMenu = () => {
    chrome.contextMenus.remove("browserAction-showPopup", checkedLastError);
    chrome.contextMenus.remove("pageAction-showPopup", checkedLastError);
    chrome.contextMenus.remove("never-translate", checkedLastError);
    chrome.contextMenus.remove("more-options", checkedLastError);
    chrome.contextMenus.remove("browserAction-translate-pdf", checkedLastError);
    chrome.contextMenus.remove("pageAction-translate-pdf", checkedLastError);

    chrome.contextMenus.create({
      id: "browserAction-showPopup",
      title: twpI18n.getMessage("btnShowPopup"),
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "pageAction-showPopup",
      title: twpI18n.getMessage("btnShowPopup"),
      contexts: ["page_action"],
    });
    chrome.contextMenus.create({
      id: "never-translate",
      title: twpI18n.getMessage("btnNeverTranslate"),
      contexts: ["action", "page_action"],
    });
    chrome.contextMenus.create({
      id: "more-options",
      title: twpI18n.getMessage("btnMoreOptions"),
      contexts: ["action", "page_action"],
    });
    chrome.contextMenus.create({
      id: "browserAction-translate-pdf",
      title: twpI18n.getMessage("msgTranslatePDF"),
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "pageAction-translate-pdf",
      title: twpI18n.getMessage("msgTranslatePDF"),
      contexts: ["page_action"],
    });
  };
  updateActionContextMenu();

  const tabHasContentScript = {};
  let currentTabId = null;
  chrome.tabs.onActivated.addListener((activeInfo) => {
    currentTabId = activeInfo.tabId;
    updateActionContextMenu();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId == "translate-web-page") {
      const mimeType = tabToMimeType[tab.id];
      if (
        mimeType &&
        mimeType.toLowerCase() === "application/pdf" &&
        chrome.pageAction &&
        chrome.pageAction.openPopup
      ) {
        chrome.pageAction.openPopup();
      } else {
        sendToggleTranslationMessage(tab.id);
      }
    } else if (info.menuItemId == "translate-restore-this-frame") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "toggle-translation",
          },
          { frameId: info.frameId },
          checkedLastError
        );
      });
    } else if (info.menuItemId == "translate-selected-text") {
      if (
        chrome.pageAction &&
        chrome.pageAction.openPopup &&
        (!tab || !tabHasContentScript[tab.id] || tab.isInReaderMode)
      ) {
        chrome.pageAction.setPopup({
          popup:
            "popup/popup-translate-text.html#text=" +
            encodeURIComponent(info.selectionText),
          tabId: tab?.id || currentTabId,
        });
        chrome.pageAction.openPopup();

        resetPageAction(tab?.id || currentTabId);
      } else {
        // a merda do chrome não suporte openPopup
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "TranslateSelectedText",
            selectionText: info.selectionText,
          },
          checkedLastError
        );
      }
    } else if (info.menuItemId == "browserAction-showPopup") {
      resetBrowserAction(true);

      if (chrome.action.openPopup) {
        chrome.action.openPopup();
      }

      resetBrowserAction();
    } else if (info.menuItemId == "pageAction-showPopup") {
      resetPageAction(tab.id, true);

      if (chrome.pageAction) {
        chrome.pageAction.openPopup();
      }

      resetPageAction(tab.id);
    } else if (info.menuItemId == "never-translate") {
      const hostname = new URL(tab.url).hostname;
      twpConfig.addSiteToNeverTranslate(hostname);
    } else if (info.menuItemId == "more-options") {
      tabsCreate(chrome.runtime.getURL("/options/options.html"));
    } else if (info.menuItemId == "browserAction-translate-pdf") {
      const mimeType = tabToMimeType[tab.id];
      if (
        mimeType &&
        mimeType.toLowerCase() === "application/pdf" &&
        typeof chrome.action.openPopup !== "undefined"
      ) {
        chrome.action.openPopup();
      } else {
        tabsCreate("https://pdf.translatewebpages.org/");
      }
    } else if (info.menuItemId == "pageAction-translate-pdf") {
      const mimeType = tabToMimeType[tab.id];
      if (
        mimeType &&
        mimeType.toLowerCase() === "application/pdf" &&
        typeof chrome.pageAction.openPopup !== "undefined"
      ) {
        chrome.pageAction.openPopup();
      } else {
        tabsCreate("https://pdf.translatewebpages.org/");
      }
    }
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    twpConfig.onReady(() => {
      updateContextMenu();
      updateTranslateSelectedContextMenu();
    });
    chrome.tabs.sendMessage(
      activeInfo.tabId,
      {
        action: "getCurrentPageLanguageState",
      },
      {
        frameId: 0,
      },
      (pageLanguageState) => {
        checkedLastError();
        if (pageLanguageState) {
          twpConfig.onReady(() => updateContextMenu(pageLanguageState));
        }
      }
    );
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status == "loading") {
      twpConfig.onReady(() => updateContextMenu());
    } else if (changeInfo.status == "complete") {
      chrome.tabs.sendMessage(
        tabId,
        {
          action: "contentScriptIsInjected",
        },
        {
          frameId: 0,
        },
        (response) => {
          checkedLastError();
          tabHasContentScript[tabId] = !!response;
        }
      );
    }
  });

  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    delete tabHasContentScript[tabId];
  });

  chrome.tabs.query({}, (tabs) =>
    tabs.forEach((tab) =>
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "contentScriptIsInjected",
        },
        {
          frameId: 0,
        },
        (response) => {
          checkedLastError();
          if (response) {
            tabHasContentScript[tab.id] = true;
          }
        }
      )
    )
  );
}

twpConfig.onReady(() => {
  if (platformInfo.isMobile.any) {
    chrome.tabs.query({}, (tabs) =>
      tabs.forEach((tab) => {
        if (chrome.pageAction) {
          chrome.pageAction.hide(tab.id);
        }
      })
    );

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status == "loading" && chrome.pageAction) {
        chrome.pageAction.hide(tabId);
      }
    });

    chrome.action.onClicked.addListener((tab) => {
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "showPopupMobile",
        },
        {
          frameId: 0,
        },
        checkedLastError
      );
    });
  } else {
    if (chrome.pageAction) {
      chrome.pageAction.onClicked.addListener((tab) => {
        if (twpConfig.get("translateClickingOnce") === "yes") {
          sendToggleTranslationMessage(tab.id);
        }
      });
    }
    chrome.action.onClicked.addListener((tab) => {
      if (twpConfig.get("translateClickingOnce") === "yes") {
        sendToggleTranslationMessage(tab.id);
      }
    });

    resetBrowserAction();

    twpConfig.onChanged((name, newvalue) => {
      switch (name) {
        case "useOldPopup":
          resetBrowserAction();
          break;
        case "translateClickingOnce":
          resetBrowserAction();
          chrome.tabs.query(
            {
              currentWindow: true,
              active: true,
            },
            (tabs) => {
              resetPageAction(tabs[0].id);
            }
          );
          break;
      }
    });

    {
      let pageLanguageState = "original";

      // https://github.com/FilipePS/Traduzir-paginas-web/issues/548
      const isFirefoxAlpenglow = function (theme) {
        let isFirefoxAlpenglowTheme = false;
        try {
          if (
            [
              '{"additional_backgrounds_alignment":["right top","left top","right top"],"additional_backgrounds_tiling":["no-repeat","no-repeat","repeat-x"],"color_scheme":null,"content_color_scheme":null,"zap_gradient":"linear-gradient(90deg, #9059FF 0%, #FF4AA2 52.08%, #FFBD4F 100%)"}',
              '{"additional_backgrounds_alignment":["right top","left top","right top"],"additional_backgrounds_tiling":["no-repeat","no-repeat","repeat-x"],"color_scheme":null,"content_color_scheme":null}',
            ].includes(JSON.stringify(theme.properties)) &&
            [
              '{"accentcolor":null,"bookmark_text":"hsla(261, 53%, 15%, 1)","button_background_active":"hsla(240, 26%, 11%, .16)","button_background_hover":"hsla(240, 26%, 11%, .08)","frame":"hsla(240, 20%, 98%, 1)","frame_inactive":null,"icons":"hsla(258, 66%, 48%, 1)","icons_attention":"hsla(180, 100%, 32%, 1)","ntp_background":"#F9F9FB","ntp_card_background":null,"ntp_text":"hsla(261, 53%, 15%, 1)","popup":"hsla(254, 46%, 21%, 1)","popup_border":"hsla(255, 100%, 94%, .32)","popup_highlight":"hsla(255, 100%, 94%, .12)","popup_highlight_text":"hsla(0, 0%, 100%, 1)","popup_text":"hsla(255, 100%, 94%, 1)","sidebar":"hsla(240, 15%, 95%, 1)","sidebar_border":"hsla(261, 53%, 15%, .24)","sidebar_highlight":"hsla(265, 100%, 72%, 1)","sidebar_highlight_text":"hsla(0, 0%, 100%, 1)","sidebar_text":"hsla(261, 53%, 15%, 1)","tab_background_separator":"hsla(261, 53%, 15%, 1)","tab_background_text":"hsla(261, 53%, 15%, 1)","tab_line":"hsla(265, 100%, 72%, 1)","tab_loading":"hsla(265, 100%, 72%, 1)","tab_selected":null,"tab_text":"hsla(261, 53%, 15%, 1)","textcolor":null,"toolbar":"hsla(0, 0%, 100%, .76)","toolbar_bottom_separator":"hsla(261, 53%, 15%, .32)","toolbar_field":"hsla(0, 0%, 100%, .8)","toolbar_field_border":"transparent","toolbar_field_border_focus":"hsla(265, 100%, 72%, 1)","toolbar_field_focus":"hsla(261, 53%, 15%, .96)","toolbar_field_highlight":"hsla(265, 100%, 72%, .32)","toolbar_field_highlight_text":null,"toolbar_field_separator":null,"toolbar_field_text":"hsla(261, 53%, 15%, 1)","toolbar_field_text_focus":"hsla(255, 100%, 94%, 1)","toolbar_text":"hsla(261, 53%, 15%, 1)","toolbar_top_separator":"transparent","toolbar_vertical_separator":"hsla(261, 53%, 15%, .2)","focus_outline":"hsla(258, 65%, 48%, 1)"}',
              '{"accentcolor":null,"bookmark_text":"hsla(261, 53%, 15%, 1)","button_background_active":"hsla(240, 26%, 11%, .16)","button_background_hover":"hsla(240, 26%, 11%, .08)","frame":"hsla(240, 20%, 98%, 1)","frame_inactive":null,"icons":"hsla(258, 66%, 48%, 1)","icons_attention":"hsla(180, 100%, 32%, 1)","ntp_background":"hsla(0, 0%, 100%, 1)","ntp_card_background":null,"ntp_text":"hsla(261, 53%, 15%, 1)","popup":"hsla(254, 46%, 21%, 1)","popup_border":"hsla(255, 100%, 94%, .32)","popup_highlight":"hsla(255, 100%, 94%, .12)","popup_highlight_text":null,"popup_text":"hsla(255, 100%, 94%, 1)","sidebar":"hsla(240, 15%, 95%, 1)","sidebar_border":"hsla(261, 53%, 15%, .24)","sidebar_highlight":"hsla(265, 100%, 72%, 1)","sidebar_highlight_text":"hsla(0, 0%, 100%, 1)","sidebar_text":"hsla(261, 53%, 15%, 1)","tab_background_separator":"hsla(261, 53%, 15%, 1)","tab_background_text":"hsla(261, 53%, 15%, 1)","tab_line":"hsla(265, 100%, 72%, 1)","tab_loading":"hsla(265, 100%, 72%, 1)","tab_selected":null,"tab_text":"hsla(261, 53%, 15%, 1)","textcolor":null,"toolbar":"hsla(0, 0%, 100%, .76)","toolbar_bottom_separator":"hsla(261, 53%, 15%, .32)","toolbar_field":"hsla(0, 0%, 100%, .8)","toolbar_field_border":"hsla(261, 53%, 15%, .32)","toolbar_field_border_focus":"hsla(265, 100%, 72%, 1)","toolbar_field_focus":"hsla(261, 53%, 15%, .96)","toolbar_field_highlight":"hsla(265, 100%, 72%, .32)","toolbar_field_highlight_text":null,"toolbar_field_separator":"hsla(261, 53%, 15%, .32)","toolbar_field_text":"hsla(261, 53%, 15%, 1)","toolbar_field_text_focus":"hsla(255, 100%, 94%, 1)","toolbar_text":"hsla(261, 53%, 15%, 1)","toolbar_top_separator":"hsla(261, 53%, 15%, 1)","toolbar_vertical_separator":"hsla(261, 53%, 15%, .08)"}',
            ].includes(JSON.stringify(theme.colors))
          ) {
            isFirefoxAlpenglowTheme = true;
          }
        } catch {}
        return isFirefoxAlpenglowTheme;
      };

      let themeColorFrame = null;
      let themeColorToolbar = null;
      let themeColorToolbarField = null;
      let themeColorFieldText = null;
      let themeColorAttention = null;
      let isUsingTheme = false;
      let isFirefoxAlpenglowTheme = false;
      if (typeof browser != "undefined" && browser.theme) {
        function onThemeUpdated() {
          browser.theme.getCurrent().then((theme) => {
            themeColorFrame = null;
            themeColorToolbar = null;
            themeColorToolbarField = null;
            themeColorFieldText = null;
            themeColorAttention = null;
            if (theme.colors && theme.colors.frame) {
              themeColorFrame = theme.colors.frame;
            }
            if (theme.colors && theme.colors.toolbar) {
              themeColorToolbar = theme.colors.toolbar;
            }
            if (theme.colors && theme.colors.toolbar_field) {
              themeColorToolbarField = theme.colors.toolbar_field;
            }
            if (theme.colors && theme.colors.toolbar_field_text) {
              themeColorFieldText = theme.colors.toolbar_field_text;
            }
            if (theme.colors && theme.colors.icons_attention) {
              themeColorAttention = theme.colors.icons_attention;
            }

            isUsingTheme = false;
            if (theme.colors || theme.images || theme.properties) {
              isUsingTheme = true;
            }

            isFirefoxAlpenglowTheme = isFirefoxAlpenglow(theme);

            updateIconInAllTabs();
          });
        }
        onThemeUpdated();
        browser.theme.onUpdated.addListener(() => onThemeUpdated());
      }

      let darkMode = false;
      darkMode = false;//matchMedia("(prefers-color-scheme: dark)").matches;
      updateIconInAllTabs();

      // matchMedia("(prefers-color-scheme: dark)").addEventListener(
      //   "change",
      //   () => {
      //     darkMode = matchMedia("(prefers-color-scheme: dark)").matches;
      //     updateIconInAllTabs();
      //   }
      // );

      function getSVGIcon(incognito = false) {
        const translated = pageLanguageState === "translated" &&
          twpConfig.get("popupBlueWhenSiteIsTranslated") === "yes";
        const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="$(fill);" opacity="$(fill-opacity);" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <g transform="translate(1 0) scale(.92)"><path d="M2 21 6.5 10 11 21M3.6 17h5.8M11 6h11M16.5 3v3M19.5 6c-.6 5-3.3 8.3-8 10M13 9c1.1 2.8 3.5 5.2 6.5 6.5"/></g>
          ${translated ? '<path d="M4 23h16"/>' : ''}
        </svg>`;

        let svg64;
        if (
          pageLanguageState === "translated" &&
          twpConfig.get("popupBlueWhenSiteIsTranslated") === "yes"
        ) {
          svg64 = svgXml.replace(/\$\(fill\-opacity\)\;/g, "1.0");
          if (isFirefoxAlpenglowTheme) {
            if (darkMode || incognito) {
              svg64 = btoa(
                svg64.replace(/\$\(fill\)\;/g, "hsla(157, 100%, 66%, 1)")
              );
            } else {
              svg64 = btoa(
                svg64.replace(/\$\(fill\)\;/g, "hsla(180, 100%, 32%, 1)")
              );
            }
          } else {
            if (
              themeColorFrame &&
              themeColorToolbar &&
              themeColorToolbarField
            ) {
              try {
                darkMode = isDarkColor(
                  standardize_color(
                    themeColorFrame,
                    themeColorToolbar,
                    themeColorToolbarField
                  )
                );
              } catch (e) {
                console.error(e);
              }
            } else if (themeColorFieldText) {
              try {
                darkMode = !isDarkColor(
                  standardize_color(
                    themeColorFieldText,
                    themeColorFieldText,
                    themeColorFieldText
                  )
                );
              } catch (e) {
                console.error(e);
              }
            }

            if (themeColorAttention) {
              svg64 = btoa(svg64.replace(/\$\(fill\)\;/g, themeColorAttention));
            } else if (!isUsingTheme && (darkMode || incognito)) {
              svg64 = btoa(svg64.replace(/\$\(fill\)\;/g, "rgb(0, 221, 255)"));
            } else if (isUsingTheme && darkMode) {
              svg64 = btoa(svg64.replace(/\$\(fill\)\;/g, "rgb(0, 221, 255)"));
            } else {
              svg64 = btoa(svg64.replace(/\$\(fill\)\;/g, "rgb(0, 97, 224)"));
            }
          }
        } else {
          if (isUsingTheme) {
            svg64 = svgXml.replace(/\$\(fill\-opacity\)\;/g, "0.9");
          } else if (darkMode || incognito) {
            svg64 = svgXml.replace(/\$\(fill\-opacity\)\;/g, "1");
          } else {
            svg64 = svgXml.replace(/\$\(fill\-opacity\)\;/g, "0.72");
          }
          if (isFirefoxAlpenglowTheme) {
            if (darkMode || incognito) {
              svg64 = btoa(
                svg64.replace(/\$\(fill\)\;/g, "hsla(255, 100%, 94%, 1)")
              );
            } else {
              svg64 = btoa(
                svg64.replace(/\$\(fill\)\;/g, "hsla(261, 53%, 15%, 1)")
              );
            }
          } else {
            if (themeColorFieldText) {
              svg64 = btoa(svg64.replace(/\$\(fill\)\;/g, themeColorFieldText));
            } else if (!isUsingTheme && (darkMode || incognito)) {
              svg64 = btoa(
                svg64.replace(/\$\(fill\)\;/g, "rgb(251, 251, 254)")
              );
            } else {
              svg64 = btoa(svg64.replace(/\$\(fill\)\;/g, "rgb(21, 20, 26)"));
            }
          }
        }

        const b64Start = "data:image/svg+xml;base64,";
        return b64Start + svg64;
      }

      function standardize_color(str1, str2, str3) {
        var ctx = new OffscreenCanvas(1, 1).getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = str1;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = str2;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = str3;
        ctx.fillRect(0, 0, 1, 1);
        var data = ctx.getImageData(0, 0, 1, 1).data;
        var rgb = [data[0], data[1], data[2]];
        ctx.fillStyle = "rgb(" + rgb.join(",") + ")";
        return ctx.fillStyle;
      }

      function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : null;
      }

      function isDarkColor(hexColor) {
        var rgb = hexToRgb(hexColor);

        // Normalizando os valores RGB para o intervalo [0, 1]
        var r = rgb.r / 255,
          g = rgb.g / 255,
          b = rgb.b / 255,
          max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          l = (max + min) / 2;

        // Verificando a luminosidade
        return l <= 0.5;
      }

      function updateIcon(tabId) {
        chrome.tabs.get(tabId, (tabInfo) => {
          const incognito = tabInfo ? tabInfo.incognito : false;

          if (chrome.pageAction) {
            resetPageAction(tabId);
            chrome.pageAction.setIcon({
              tabId: tabId,
              path: getSVGIcon(incognito),
            });

            if (twpConfig.get("showButtonInTheAddressBar") == "no") {
              chrome.pageAction.hide(tabId);
            } else {
              chrome.pageAction.show(tabId);
            }
          }

          if (chrome.action) {
            if (
              pageLanguageState === "translated" &&
              twpConfig.get("popupBlueWhenSiteIsTranslated") === "yes"
            ) {
              chrome.action.setIcon({
                tabId: tabId,
                path: {
                  16: "/icons/icon-16-translated.png",
                  32: "/icons/icon-32-translated.png",
                  48: "/icons/icon-48-translated.png",
                },
              });
            } else {
              chrome.action.setIcon({
                tabId: tabId,
                path: {
                  16: "/icons/icon-16.png",
                  32: "/icons/icon-32.png",
                  48: "/icons/icon-48.png",
                },
              });
            }
          }
        });
      }

      function updateIconInAllTabs() {
        chrome.tabs.query({}, (tabs) =>
          tabs.forEach((tab) => updateIcon(tab.id))
        );
      }

      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status == "loading") {
          pageLanguageState = "original";
          updateIcon(tabId);
        } else if (changeInfo.status == "complete") {
          chrome.tabs.sendMessage(
            tabId,
            {
              action: "getCurrentPageLanguageState",
            },
            {
              frameId: 0,
            },
            (_pageLanguageState) => {
              checkedLastError();
              if (_pageLanguageState) {
                pageLanguageState = _pageLanguageState;
                updateIcon(tabId);
              }
            }
          );
        }
      });

      chrome.tabs.onActivated.addListener((activeInfo) => {
        pageLanguageState = "original";
        updateIcon(activeInfo.tabId);
        chrome.tabs.sendMessage(
          activeInfo.tabId,
          {
            action: "getCurrentPageLanguageState",
          },
          {
            frameId: 0,
          },
          (_pageLanguageState) => {
            checkedLastError();
            if (_pageLanguageState) {
              pageLanguageState = _pageLanguageState;
              updateIcon(activeInfo.tabId);
            }
          }
        );
      });

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "setPageLanguageState") {
          pageLanguageState = request.pageLanguageState;
          updateIcon(sender.tab.id);
        }
      });

      twpConfig.onChanged((name, newvalue) => {
        switch (name) {
          case "useOldPopup":
            updateIconInAllTabs();
            break;
          case "showButtonInTheAddressBar":
            updateIconInAllTabs();
            break;
        }
      });
    }
  }
});

if (typeof chrome.commands !== "undefined") {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "hotkey-toggle-translation") {
      chrome.tabs.query(
        {
          currentWindow: true,
          active: true,
        },
        (tabs) => sendToggleTranslationMessage(tabs[0].id)
      );
    } else if (command === "hotkey-translate-selected-text") {
      chrome.tabs.query(
        {
          currentWindow: true,
          active: true,
        },
        (tabs) =>
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "TranslateSelectedText",
            },
            checkedLastError
          )
      );
    } else if (command === "hotkey-swap-page-translation-service") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) =>
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "swapTranslationService",
              newServiceName: twpConfig.swapPageTranslationService(),
            },
            checkedLastError
          )
      );
    } else if (command === "hotkey-show-original") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) =>
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "translatePage",
              targetLanguage: "original",
            },
            checkedLastError
          )
      );
    } else if (command === "hotkey-translate-page-1") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          twpConfig.setTargetLanguage(twpConfig.get("targetLanguages")[0]);
          sendTranslatePageMessage(
            tabs[0].id,
            twpConfig.get("targetLanguages")[0]
          );
        }
      );
    } else if (command === "hotkey-translate-page-2") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          twpConfig.setTargetLanguage(twpConfig.get("targetLanguages")[1]);
          sendTranslatePageMessage(
            tabs[0].id,
            twpConfig.get("targetLanguages")[1]
          );
        }
      );
    } else if (command === "hotkey-translate-page-3") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          twpConfig.setTargetLanguage(twpConfig.get("targetLanguages")[2]);
          sendTranslatePageMessage(
            tabs[0].id,
            twpConfig.get("targetLanguages")[2]
          );
        }
      );
    } else if (command === "hotkey-hot-translate-selected-text") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "hotTranslateSelectedText",
            },
            checkedLastError
          );
        }
      );
    }
  });
}

twpConfig.onReady(async () => {
  updateContextMenu();
  updateTranslateSelectedContextMenu();

  twpConfig.onChanged((name, newvalue) => {
    if (name === "showTranslateSelectedContextMenu") {
      updateTranslateSelectedContextMenu();
    }
  });

  if (!twpConfig.get("installDateTime")) {
    twpConfig.set("installDateTime", Date.now());
  }
});

twpConfig.onReady(async () => {
  let navigationsInfo = {};
  let tabsInfo = {};

  function tabsOnRemoved(tabId) {
    delete navigationsInfo[tabId];
    delete tabsInfo[tabId];
  }

  function runtimeOnMessage(request, sender, sendResponse) {
    if (request.action === "setPageLanguageState") {
      tabsInfo[sender.tab.id] = {
        pageLanguageState: request.pageLanguageState,
        host: new URL(sender.tab.url).host,
      };
    }
  }

  //TODO ver porque no Firefox o evento OnCommitted executa antes de OnCreatedNavigationTarget e OnBeforeNavigate quando [target="_blank"]

  function webNavigationOnCreatedNavigationTarget(details) {
    const navInfo = navigationsInfo[details.tabId] || {};
    navInfo.sourceTabId = details.sourceTabId;
    navigationsInfo[details.tabId] = navInfo;
  }

  function webNavigationOnBeforeNavigate(details) {
    if (details.frameId !== 0) return;

    const navInfo = navigationsInfo[details.tabId] || {
      sourceTabId: details.tabId,
    };
    navInfo.beforeNavigateIsExecuted = true;
    if (tabsInfo[navInfo.sourceTabId]) {
      navInfo.sourceHost = tabsInfo[navInfo.sourceTabId].host;
      navInfo.sourcePageLanguageState =
        tabsInfo[navInfo.sourceTabId].pageLanguageState;
    }
    navigationsInfo[details.tabId] = navInfo;

    if (navInfo.promise_resolve) {
      navInfo.promise_resolve();
    }
  }

  async function webNavigationOnCommitted(details) {
    if (details.frameId !== 0) return;

    const navInfo = navigationsInfo[details.tabId] || {
      sourceTabId: details.tabId,
    };
    navInfo.transitionType = details.transitionType;
    navigationsInfo[details.tabId] = navInfo;

    if (!navInfo.beforeNavigateIsExecuted) {
      await new Promise((resolve) => (navInfo.promise_resolve = resolve));
    }
  }

  function webNavigationOnDOMContentLoaded(details) {
    if (details.frameId !== 0) return;

    const navInfo = navigationsInfo[details.tabId];

    if (navInfo && navInfo.sourceHost) {
      const host = new URL(details.url).host;
      if (
        navInfo.transitionType === "link" &&
        navInfo.sourcePageLanguageState === "translated" &&
        navInfo.sourceHost === host
      ) {
        setTimeout(
          () =>
            chrome.tabs.sendMessage(
              details.tabId,
              {
                action: "autoTranslateBecauseClickedALink",
              },
              {
                frameId: 0,
              },
              checkedLastError
            ),
          500
        );
      }
    }

    delete navigationsInfo[details.tabId];
  }

  function enableTranslationOnClickingALink() {
    disableTranslationOnClickingALink();
    if (!chrome.webNavigation) return;

    chrome.tabs.onRemoved.addListener(tabsOnRemoved);
    chrome.runtime.onMessage.addListener(runtimeOnMessage);

    chrome.webNavigation.onCreatedNavigationTarget.addListener(
      webNavigationOnCreatedNavigationTarget
    );
    chrome.webNavigation.onBeforeNavigate.addListener(
      webNavigationOnBeforeNavigate
    );
    chrome.webNavigation.onCommitted.addListener(webNavigationOnCommitted);
    chrome.webNavigation.onDOMContentLoaded.addListener(
      webNavigationOnDOMContentLoaded
    );
  }

  function disableTranslationOnClickingALink() {
    navigationsInfo = {};
    tabsInfo = {};
    chrome.tabs.onRemoved.removeListener(tabsOnRemoved);
    chrome.runtime.onMessage.removeListener(runtimeOnMessage);

    if (chrome.webNavigation) {
      chrome.webNavigation.onCreatedNavigationTarget.removeListener(
        webNavigationOnCreatedNavigationTarget
      );
      chrome.webNavigation.onBeforeNavigate.removeListener(
        webNavigationOnBeforeNavigate
      );
      chrome.webNavigation.onCommitted.removeListener(webNavigationOnCommitted);
      chrome.webNavigation.onDOMContentLoaded.removeListener(
        webNavigationOnDOMContentLoaded
      );
    } else {
      console.info("No webNavigation permission");
    }
  }

  twpConfig.onChanged((name, newvalue) => {
    if (name === "autoTranslateWhenClickingALink") {
      if (newvalue == "yes") {
        enableTranslationOnClickingALink();
      } else {
        disableTranslationOnClickingALink();
      }
    }
  });

  if (chrome.permissions.onRemoved) {
    chrome.permissions.onRemoved.addListener((permissions) => {
      if (permissions.permissions.indexOf("webNavigation") !== -1) {
        twpConfig.set("autoTranslateWhenClickingALink", "no");
      }
    });
  }

  chrome.permissions.contains(
    {
      permissions: ["webNavigation"],
    },
    (hasPermissions) => {
      if (
        hasPermissions &&
        twpConfig.get("autoTranslateWhenClickingALink") === "yes"
      ) {
        enableTranslationOnClickingALink();
      } else {
        twpConfig.set("autoTranslateWhenClickingALink", "no");
      }
    }
  );
});

// garante que a extensão só seja atualizada quando reiniciar o navegador.
// caso seja uma atualização manual, realiza uma limpeza e recarrega a extensão para instalar a atualização.
chrome.runtime.onUpdateAvailable.addListener((details) => {
  var reloaded = false;

  setTimeout(function () {
    if (!reloaded) {
      reloaded = true;
      chrome.runtime.reload();
    }
  }, 2200);

  chrome.tabs.query({}, (tabs) => {
    const cleanUpsPromises = [];
    tabs.forEach((tab) => {
      cleanUpsPromises.push(
        new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { action: "cleanUp" }, resolve);
        })
      );
    });
    Promise.all(cleanUpsPromises).finally(() => {
      if (!reloaded) {
        reloaded = true;
        chrome.runtime.reload();
      }
    });
  });

  // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //   const url = new URL(tabs[0].url);
  //   if (
  //     (url.hostname === "github.com" &&
  //       url.pathname.includes("FilipePS/Traduzir-paginas-web/releases")) ||
  //     (url.hostname === "addons.mozilla.org" &&
  //       url.pathname.includes("addon/traduzir-paginas-web/versions"))
  //   ) {
  //     chrome.tabs.query({}, (tabs) => {
  //       const cleanUpsPromises = [];
  //       tabs.forEach((tab) => {
  //         cleanUpsPromises.push(
  //           new Promise((resolve) => {
  //             chrome.tabs.sendMessage(tab.id, { action: "cleanUp" }, resolve);
  //           })
  //         );
  //       });
  //       Promise.all(cleanUpsPromises).finally(() => {
  //         chrome.runtime.reload();
  //       });
  //     });
  //   }
  // });
});
