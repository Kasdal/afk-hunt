# afk-hunt
tera-proxy module to afk hunt worldbosses!

Requires:
- https://github.com/pinkipi/command
- https://github.com/request/request
- TERA Elite (For AFK Hunting)

Functions:
- AFK Hunting
- Share found / killed Worldboss with Player and Guild
- Sync information with Worldboss Database (Webinterface available soon!)
- Skip Worldbosses / Channel when on Cooldown
- Supported regions: EU, NA, RU, KR, JP, TW
- Remote Control (under development)

Commands:
- wb - Check next Worldboss / Checkpoint / Channel
- wbhunt - (toggle) AFK Hunting
- wbdata - Show loaded Worldbosses with index
- wbskip - (toggle) Skip Worldbosses / Channel when on Cooldown
- wbshare - (toggle) Share found / killed Worldboss in guild chat (use at your own risk)
- wbautostop - (toggle) Stops AFK hunt when you found a Worldboss
- wbremote [player] - Add Player to notify when u find a Worldboss
- wbclear - Clear Player list
- wbgo [wb index] [checkpoint] - instant tp to desired Worldboss / Checkpoint

Webinterface (Limited Access only)

![https://ibb.co/e3fgKG](https://thumb.ibb.co/e3fgKG/afk_hunt_webinterface.png)

[Preview](https://ibb.co/e3fgKG)

Known issues:
- Randomly desyncs with Server
- If you get in fight at a Checkpoint, the AFK hunt can't proceed

ToDo:
- Better Checkpoints
- Auto Kill Mobs and proceed when out of Fight
