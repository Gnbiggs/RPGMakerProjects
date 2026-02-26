/*:
 * @target MZ
 * @plugindesc Quest Journal (JSON-backed) - adds a Journal command to the main menu with quest list + details, and plugin commands to start/update/complete quests.
 * @author ChatGPT
 *
 * @help
 * QuestJournal.js
 *
 * This plugin:
 *  - Loads quest definitions from data/Quests.json into $dataQuests
 *  - Adds "Journal" to the main menu
 *  - Shows a quest list; selecting a quest shows its details
 *  - Provides plugin commands so you don't write per-quest JS in events
 *
 * --- Setup ---
 * 1) Put this plugin in: js/plugins/QuestJournal.js
 * 2) Create: data/Quests.json (see example below)
 * 3) Enable the plugin in Plugin Manager
 *
 * --- Quests.json format ---
 * [
 *   {
 *     "id": "potion_quest",
 *     "title": "Potion Quest",
 *     "stages": {
 *       "1": "Doc has asked to get a Potion...",
 *       "2": "You found the tower..."
 *     }
 *   }
 * ]
 *
 * Notes:
 * - Stage keys are strings in JSON ("1","2",...) but you can pass numbers in plugin commands.
 * - Quest progress/state is saved in save files via $gameSystem.
 *
 * @command StartQuest
 * @text Start Quest
 * @desc Start a quest at a given stage (usually 1).
 *
 * @arg id
 * @type string
 * @text Quest ID
 *
 * @arg stage
 * @type number
 * @min 1
 * @default 1
 * @text Stage
 *
 * @arg popup
 * @type boolean
 * @default true
 * @text Show Popup
 * @desc Show a message like "Quest Started: <title>".
 *
 * @command SetQuestStage
 * @text Set Quest Stage
 * @desc Update a quest to a new stage.
 *
 * @arg id
 * @type string
 * @text Quest ID
 *
 * @arg stage
 * @type number
 * @min 1
 * @default 1
 * @text Stage
 *
 * @arg popup
 * @type boolean
 * @default true
 * @text Show Popup
 *
 * @command CompleteQuest
 * @text Complete Quest
 * @desc Mark a quest as completed.
 *
 * @arg id
 * @type string
 * @text Quest ID
 *
 * @arg popup
 * @type boolean
 * @default true
 * @text Show Popup
 *
 * @command FailQuest
 * @text Fail Quest
 * @desc Mark a quest as failed.
 *
 * @arg id
 * @type string
 * @text Quest ID
 *
 * @arg popup
 * @type boolean
 * @default true
 * @text Show Popup
 */

(() => {
  "use strict";
  const PLUGIN_NAME = "QuestJournal";

  // ------------------------------------------------------------
  // Load quest definitions: data/Quests.json -> $dataQuests
  // ------------------------------------------------------------
  window.$dataQuests = null;

  const _DataManager_loadDatabase = DataManager.loadDatabase;
  DataManager.loadDatabase = function() {
    _DataManager_loadDatabase.call(this);
    this.loadDataFile("$dataQuests", "Quests.json");
  };

  // Helper: look up quest definition by id
  function questDef(id) {
    if (!$dataQuests) return null;
    return $dataQuests.find(q => q && q.id === id) || null;
  }

  function questTitle(id) {
    const def = questDef(id);
    return def ? def.title : id;
  }

  function questStageText(id, stage) {
    const def = questDef(id);
    if (!def) return "(Missing quest definition in data/Quests.json)";
    const key = String(stage);
    const text = def.stages && def.stages[key];
    return text ? text : "(Missing text for stage " + key + ")";
  }

  // ------------------------------------------------------------
  // Saved quest state (per save file) in $gameSystem
  // ------------------------------------------------------------
  Game_System.prototype.questJournalState = function() {
    if (!this._questJournalState) this._questJournalState = {};
    return this._questJournalState;
  };

  Game_System.prototype.startQuest = function(id, stage) {
    const s = this.questJournalState();
    s[id] = {
      id,
      stage: Number(stage || 1),
      status: "active", // active | complete | failed
      updatedAt: Date.now()
    };
  };

  Game_System.prototype.setQuestStage = function(id, stage) {
    const s = this.questJournalState();
    if (!s[id]) {
      // If someone updates before starting, treat as start.
      this.startQuest(id, stage);
      return;
    }
    s[id].stage = Number(stage || s[id].stage || 1);
    s[id].status = "active";
    s[id].updatedAt = Date.now();
  };

  Game_System.prototype.completeQuest = function(id) {
    const s = this.questJournalState();
    if (!s[id]) this.startQuest(id, 1);
    s[id].status = "complete";
    s[id].updatedAt = Date.now();
  };

  Game_System.prototype.failQuest = function(id) {
    const s = this.questJournalState();
    if (!s[id]) this.startQuest(id, 1);
    s[id].status = "failed";
    s[id].updatedAt = Date.now();
  };

  Game_System.prototype.getQuestStatesSorted = function() {
    const s = this.questJournalState();
    return Object.values(s).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  };

  // ------------------------------------------------------------
  // Plugin Commands (Event Command -> Plugin Command)
  // ------------------------------------------------------------
  function maybePopup(kind, id, stage, popup) {
    if (!popup) return;
    const title = questTitle(id);
    if (kind === "start") {
      $gameMessage.add("Quest Started: " + title);
    } else if (kind === "stage") {
      $gameMessage.add("Quest Updated: " + title + " (Stage " + stage + ")");
    } else if (kind === "complete") {
      $gameMessage.add("Quest Completed: " + title);
    } else if (kind === "failed") {
      $gameMessage.add("Quest Failed: " + title);
    }
  }

  PluginManager.registerCommand(PLUGIN_NAME, "StartQuest", args => {
    const id = String(args.id || "");
    const stage = Number(args.stage || 1);
    const popup = args.popup === "true";
    if (!id) return;
    $gameSystem.startQuest(id, stage);
    maybePopup("start", id, stage, popup);
  });

  PluginManager.registerCommand(PLUGIN_NAME, "SetQuestStage", args => {
    const id = String(args.id || "");
    const stage = Number(args.stage || 1);
    const popup = args.popup === "true";
    if (!id) return;
    $gameSystem.setQuestStage(id, stage);
    maybePopup("stage", id, stage, popup);
  });

  PluginManager.registerCommand(PLUGIN_NAME, "CompleteQuest", args => {
    const id = String(args.id || "");
    const popup = args.popup === "true";
    if (!id) return;
    $gameSystem.completeQuest(id);
    maybePopup("complete", id, 0, popup);
  });

  PluginManager.registerCommand(PLUGIN_NAME, "FailQuest", args => {
    const id = String(args.id || "");
    const popup = args.popup === "true";
    if (!id) return;
    $gameSystem.failQuest(id);
    maybePopup("failed", id, 0, popup);
  });

  // ------------------------------------------------------------
  // Menu integration: add command + handler
  // ------------------------------------------------------------
  const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
  Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.call(this);
    this.addCommand("Journal", "questJournal", true);
  };

  const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.call(this);
    // _commandWindow exists after the original call
    this._commandWindow.setHandler("questJournal", this.commandQuestJournal.bind(this));
  };

  Scene_Menu.prototype.commandQuestJournal = function() {
    SceneManager.push(Scene_QuestJournal);
  };

  // ------------------------------------------------------------
  // Windows: list + details
  // ------------------------------------------------------------
  function statusLabel(status) {
    if (status === "complete") return "[Complete]";
    if (status === "failed") return "[Failed]";
    return "[Active]";
  }

  class Window_QuestList extends Window_Command {
    initialize(rect) {
      super.initialize(rect);
      this._questStates = [];
      this.refresh();
      this.select(0);
      this.activate();
    }

    makeCommandList() {
      this._questStates = $gameSystem.getQuestStatesSorted();
      if (!this._questStates.length) {
        this.addCommand("(No quests yet)", "none", false);
        return;
      }
      for (const qs of this._questStates) {
        const title = questTitle(qs.id);
        const label = `${title} ${statusLabel(qs.status)}`;
        this.addCommand(label, qs.id, true);
      }
    }

    currentQuestId() {
      const symbol = this.currentSymbol();
      if (!symbol || symbol === "none") return null;
      return symbol;
    }
  }

  class Window_QuestDetails extends Window_Base {
    initialize(rect) {
      super.initialize(rect);
      this._questId = null;
      this._questStage = 1;
      this._questStatus = "active";
      this.refresh();
    }

    setQuest(questId) {
      this._questId = questId;
      const state = questId ? $gameSystem.questJournalState()[questId] : null;
      if (state) {
        this._questStage = state.stage || 1;
        this._questStatus = state.status || "active";
      } else {
        this._questStage = 1;
        this._questStatus = "active";
      }
      this.refresh();
    }

    refresh() {
      this.contents.clear();
      const iw = this.innerWidth;
      const lineH = this.lineHeight();

      if (!this._questId) {
        this.drawText("Select a quest.", 0, 0, iw);
        return;
      }

      const title = questTitle(this._questId);
      const stage = this._questStage;
      const status = this._questStatus;

      // Title
      this.changeTextColor(ColorManager.systemColor());
      this.drawText(title, 0, 0, iw);
      this.resetTextColor();

      // Status + stage
      this.drawText(`${statusLabel(status)}  Stage ${stage}`, 0, lineH, iw);

      // Body
      const body = questStageText(this._questId, stage);
      const y = lineH * 3;
      this.drawTextEx(body, 0, y, iw);
    }
  }

  // ------------------------------------------------------------
  // Scene
  // ------------------------------------------------------------
  class Scene_QuestJournal extends Scene_MenuBase {
    create() {
      super.create();
      this.createQuestWindows();
    }

    createQuestWindows() {
      const listRect = this.questListRect();
      const detailRect = this.questDetailRect();

      this._questListWindow = new Window_QuestList(listRect);
      this._questListWindow.setHandler("ok", this.onQuestOk.bind(this));
      this._questListWindow.setHandler("cancel", this.popScene.bind(this));
      this._questListWindow.setHandler("pagedown", this.nextActor.bind(this));
      this._questListWindow.setHandler("pageup", this.previousActor.bind(this));
      this.addWindow(this._questListWindow);

      this._questDetailWindow = new Window_QuestDetails(detailRect);
      this.addWindow(this._questDetailWindow);

      // Initial selection -> details
      this._lastQuestId = this._questListWindow.currentQuestId();
      this._questDetailWindow.setQuest(this._lastQuestId);
    }

    questListRect() {
      const wx = 0;
      const wy = this.mainAreaTop();
      const ww = Math.floor(Graphics.boxWidth * 0.42);
      const wh = this.mainAreaHeight();
      return new Rectangle(wx, wy, ww, wh);
    }

    questDetailRect() {
      const wx = Math.floor(Graphics.boxWidth * 0.42);
      const wy = this.mainAreaTop();
      const ww = Graphics.boxWidth - wx;
      const wh = this.mainAreaHeight();
      return new Rectangle(wx, wy, ww, wh);
    }

    update() {
      super.update();
      const currentId = this._questListWindow.currentQuestId();
      if (currentId !== this._lastQuestId) {
        this._lastQuestId = currentId;
        this._questDetailWindow.setQuest(currentId);
      }
    }

    onQuestOk() {
      // No separate details scene; OK just keeps focus on list.
      this._questListWindow.activate();
    }
  }

  window.Scene_QuestJournal = Scene_QuestJournal;

})();
