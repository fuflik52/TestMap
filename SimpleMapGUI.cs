using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using Oxide.Core;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("SimpleMapGUI", "fufel", "1.0.4")]
    public class SimpleMapGUI : RustPlugin
    {
        uint mapId;

        private const string DefaultHttpHost = "+";
        private const int DefaultHttpPort = 28080;

        private const string UiName = "M";
        private const float DefaultMapScale = 0.5f;
        private const int DefaultMapMargin = 500;
        private const float DefaultSampleIntervalSeconds = 1f;
        private const float DefaultFlushIntervalSeconds = 5f;
        private const int DefaultMaxSamplesToServe = 6000;

        private HttpListener _http;
        private System.Threading.Thread _httpThread;
        private readonly object _sync = new object();

        private readonly Dictionary<ulong, ActiveSession> _activeByPlayer = new Dictionary<ulong, ActiveSession>();
        private readonly Dictionary<string, ActivitySession> _sessionsById = new Dictionary<string, ActivitySession>(StringComparer.OrdinalIgnoreCase);

        private int _httpPort;
        private string _httpHost;
        private bool _logHttp;

        private void GenerateMap()
        {
            int w, h; Color bg;
            var bytes = MapImageRenderer.Render(out w, out h, out bg, 0.5f, false);
            if (bytes != null) mapId = FileStorage.server.Store(bytes, FileStorage.Type.png, default(NetworkableId));
        }

        protected override void LoadDefaultConfig()
        {
            // Default is external access: bind on all interfaces. If you want local-only, set to 127.0.0.1.
            Config["HttpHost"] = DefaultHttpHost;
            Config["HttpPort"] = DefaultHttpPort;
            Config["AutoPortFallback"] = true;
            Config["PortFallbackAttempts"] = 20;
            Config["LogHttpRequests"] = true;
            Config["SampleIntervalSeconds"] = DefaultSampleIntervalSeconds;
            Config["FlushIntervalSeconds"] = DefaultFlushIntervalSeconds;
            Config["MaxSamplesToServe"] = DefaultMaxSamplesToServe;
            Config["MapScale"] = DefaultMapScale;
            Config["MapMargin"] = DefaultMapMargin;
        }

        private void Init()
        {
            var changed = false;

            var host = Convert.ToString(Config["HttpHost"]);
            if (string.IsNullOrWhiteSpace(host) || string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) || host == "127.0.0.1")
            {
                host = DefaultHttpHost;
                Config["HttpHost"] = host;
                changed = true;
            }

            var port = Convert.ToInt32(Config["HttpPort"] ?? DefaultHttpPort);
            if (port <= 0)
            {
                port = DefaultHttpPort;
                Config["HttpPort"] = port;
                changed = true;
            }

            // Ensure new keys exist without requiring manual config edits
            if (Config["AutoPortFallback"] == null)
            {
                Config["AutoPortFallback"] = true;
                changed = true;
            }
            if (Config["PortFallbackAttempts"] == null)
            {
                Config["PortFallbackAttempts"] = 20;
                changed = true;
            }

            if (Config["LogHttpRequests"] == null)
            {
                Config["LogHttpRequests"] = true;
                changed = true;
            }

            if (changed) SaveConfig();

            _httpHost = host;
            _httpPort = port;
            _logHttp = Convert.ToBoolean(Config["LogHttpRequests"] ?? true);
        }

        private void LogHttp(string message)
        {
            if (!_logHttp) return;
            Puts($"[HTTP] {message}");
        }

        private static string NormalizeMatchId(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return id;
            id = id.Trim();
            if (id.StartsWith("m-", StringComparison.OrdinalIgnoreCase))
                return id.Substring(2);
            return id;
        }

        private static IEnumerable<string> MatchIdCandidates(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) yield break;
            id = id.Trim('/').Trim();

            yield return id;

            var normalized = NormalizeMatchId(id);
            if (!string.Equals(normalized, id, StringComparison.OrdinalIgnoreCase))
                yield return normalized;

            if (!id.StartsWith("m-", StringComparison.OrdinalIgnoreCase))
                yield return "m-" + id;
        }

        private void OnServerInitialized()
        {
            StartHttp();
        }

        private void Unload()
        {
            lock (_sync)
            {
                foreach (var kv in _activeByPlayer)
                {
                    kv.Value?.SampleTimer?.Destroy();
                    kv.Value?.FlushTimer?.Destroy();
                    FlushActive(kv.Value, finalFlush: true);
                }
                _activeByPlayer.Clear();
            }

            StopHttp();
        }

        [ConsoleCommand("123map")]
        void Cmd(ConsoleSystem.Arg a)
        {
            var p = a.Player();
            if (p == null) return;
            var c = new CuiElementContainer();
            var m = c.Add(new CuiPanel { RectTransform = { AnchorMin = "0.1 0.1", AnchorMax = "0.9 0.9" }, CursorEnabled = true, Image = { Color = "0 0 0 0.9" } }, "Overlay", UiName);
            
            if (mapId == 0) GenerateMap();
            
            if (mapId > 0)
                c.Add(new CuiElement { Parent = m, Components = { new CuiRawImageComponent { Png = mapId.ToString() }, new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" } } });

            float s = 0.5f;
            int margin = 500;
            float worldSize = World.Size;
            float mapPixelSize = worldSize * s + margin * 2;

            // --- Grid Generation ---
            float cellSizeBase = 146.28572f;
            int gridCells = Mathf.FloorToInt(worldSize / cellSizeBase + 0.001f);
            float cellSize = worldSize / gridCells;
            
            float WorldToMap(float val) => (margin + (val + worldSize / 2f) * s) / mapPixelSize;
            float uiMin = WorldToMap(-worldSize / 2f); // Left/Bottom of map area
            float uiMax = WorldToMap(worldSize / 2f);  // Right/Top of map area

            // Draw Vertical Lines
            for (int i = 0; i <= gridCells; i++)
            {
                float wPos = -worldSize / 2f + i * cellSize;
                float uiPos = WorldToMap(wPos);
                if (i > 0 && i < gridCells)
                    c.Add(new CuiElement { Parent = m, Components = { new CuiImageComponent { Color = "1 1 1 0.15" }, new CuiRectTransformComponent { AnchorMin = $"{uiPos} {uiMin}", AnchorMax = $"{uiPos + 0.0005} {uiMax}" } } });
            }

            // Draw Horizontal Lines
            for (int i = 0; i <= gridCells; i++)
            {
                float wPos = worldSize / 2f - i * cellSize;
                float uiPos = WorldToMap(wPos);
                if (i > 0 && i < gridCells)
                    c.Add(new CuiElement { Parent = m, Components = { new CuiImageComponent { Color = "1 1 1 0.15" }, new CuiRectTransformComponent { AnchorMin = $"{uiMin} {uiPos}", AnchorMax = $"{uiMax} {uiPos + 0.0008}" } } });
            }

            // Draw Cell Labels (e.g. A1, B2) inside cells
            for (int x = 0; x < gridCells; x++)
            {
                for (int y = 0; y < gridCells; y++)
                {
                    // Calculate center of the cell
                    float wPosX = -worldSize / 2f + x * cellSize + cellSize / 2f;
                    float wPosY = worldSize / 2f - y * cellSize - cellSize / 2f; 
                    
                    float uiX = WorldToMap(wPosX);
                    float uiY = WorldToMap(wPosY);

                    string label = $"{GetGridLetter(x)}{y}";

                    c.Add(new CuiElement { 
                        Parent = m, 
                        Components = { 
                            new CuiTextComponent { Text = label, FontSize = 12, Align = TextAnchor.MiddleCenter, Color = "1 1 1 0.3", Font = "robotocondensed-bold.ttf" }, 
                            new CuiRectTransformComponent { AnchorMin = $"{uiX - 0.02} {uiY - 0.02}", AnchorMax = $"{uiX + 0.02} {uiY + 0.02}" } 
                        } 
                    });
                }
            }
            // -----------------------

            if (TerrainMeta.Path?.Landmarks != null)
            {
                foreach (var l in TerrainMeta.Path.Landmarks)
                {
                    if (!l.shouldDisplayOnMap) continue;
                    var pos = l.transform.position;
                    var x = (margin + (pos.x + worldSize / 2f) * s) / mapPixelSize;
                    var y = (margin + (pos.z + worldSize / 2f) * s) / mapPixelSize;
                    if (x >= 0 && x <= 1 && y >= 0 && y <= 1)
                    {
                        var t = l.displayPhrase?.english ?? l.name;
                        if (!string.IsNullOrEmpty(t))
                            c.Add(new CuiElement { Parent = m, Components = { new CuiTextComponent { Text = t, FontSize = 10, Align = TextAnchor.MiddleCenter, Color = "1 1 1 1", Font = "robotocondensed-bold.ttf" }, new CuiRectTransformComponent { AnchorMin = $"{x - 0.05} {y - 0.01}", AnchorMax = $"{x + 0.05} {y + 0.01}" }, new CuiOutlineComponent { Color = "0 0 0 1", Distance = "0.5 0.5" } } });
                    }
                }
            }

            foreach (var pl in BasePlayer.activePlayerList)
            {
                var pos = pl.transform.position;
                var x = (margin + (pos.x + worldSize / 2f) * s) / mapPixelSize;
                var y = (margin + (pos.z + worldSize / 2f) * s) / mapPixelSize;

                if (x >= 0 && x <= 1 && y >= 0 && y <= 1)
                {
                    c.Add(new CuiElement { 
                        Parent = m, 
                        Components = { 
                            new CuiImageComponent { Color = "1 0.92 0.016 1", Sprite = "assets/icons/circle_closed.png" }, 
                            new CuiRectTransformComponent { AnchorMin = $"{x - 0.005} {y - 0.005}", AnchorMax = $"{x + 0.005} {y + 0.005}" } 
                        } 
                    });
                }
            }
            c.Add(new CuiButton { Button = { Command = "simplemap.close", Color = "0.8 0.2 0.2 1" }, RectTransform = { AnchorMin = "0.95 0.95", AnchorMax = "1 1" }, Text = { Text = "X", Align = TextAnchor.MiddleCenter } }, m);
            CuiHelper.DestroyUi(p, UiName);
            CuiHelper.AddUi(p, c);
        }

        [ConsoleCommand("simplemap.close")]
        void CloseCmd(ConsoleSystem.Arg a)
        {
            var p = a.Player();
            if (p != null) CuiHelper.DestroyUi(p, UiName);
        }

        // ----------------------------
        // Activity recording (solo run)
        // ----------------------------

        [ChatCommand("solo")]
        private void ChatSolo(BasePlayer player, string command, string[] args)
        {
            var matchId = (args != null && args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
                ? args[0]
                : null;
            StartSoloSession(player, matchId);
        }

        [ChatCommand("solostop")]
        private void ChatSoloStop(BasePlayer player, string command, string[] args)
        {
            if (player == null) return;
            StopSoloSession(player.userID, "manual");
        }

        [ChatCommand("solostart")]
        private void ChatSoloStart(BasePlayer player, string command, string[] args)
        {
            if (player == null) return;
            var matchId = (args != null && args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
                ? args[0]
                : null;
            StartSoloSession(player, matchId);
        }

        [ConsoleCommand("activity.start")]
        private void ActivityStart(ConsoleSystem.Arg a)
        {
            var player = a.Player();
            if (player == null) return;

            var matchId = a.Args != null && a.Args.Length > 0 ? a.Args[0] : null;
            StartSoloSession(player, matchId);
        }

        [ConsoleCommand("activity.stop")]
        private void ActivityStop(ConsoleSystem.Arg a)
        {
            var player = a.Player();
            if (player == null) return;
            StopSoloSession(player.userID, "manual");
        }

        private void StartSoloSession(BasePlayer player, string matchId)
        {
            if (player == null || !player.IsConnected) return;

            var interval = Convert.ToSingle(Config["SampleIntervalSeconds"] ?? DefaultSampleIntervalSeconds);
            if (interval < 0.1f) interval = 0.1f;

            var flushInterval = Convert.ToSingle(Config["FlushIntervalSeconds"] ?? DefaultFlushIntervalSeconds);
            if (flushInterval < 1f) flushInterval = 1f;

            var mapScale = Convert.ToSingle(Config["MapScale"] ?? DefaultMapScale);
            if (mapScale <= 0f) mapScale = DefaultMapScale;

            var margin = Convert.ToInt32(Config["MapMargin"] ?? DefaultMapMargin);
            if (margin < 0) margin = DefaultMapMargin;

            var worldSize = World.Size;
            var seed = World.Seed;

            var sessionId = string.IsNullOrWhiteSpace(matchId)
                ? $"solo-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}"
                : matchId;

            lock (_sync)
            {
                if (_activeByPlayer.TryGetValue(player.userID, out var existing) && existing != null)
                {
                    existing.SampleTimer?.Destroy();
                    existing.FlushTimer?.Destroy();
                    FlushActive(existing, finalFlush: true);
                    _activeByPlayer.Remove(player.userID);
                }

                var session = new ActivitySession
                {
                    id = sessionId,
                    startedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    playerId = player.userID.ToString(),
                    playerName = player.displayName,
                    worldSize = worldSize,
                    seed = seed,
                    mapScale = mapScale,
                    margin = margin,
                    deaths = new List<DeathEvent>(1),
                    mapPngFile = EnsureMapPng(seed, worldSize, mapScale),
                    samplesFile = EnsureSamplesFile(sessionId),
                    sampleCount = 0,
                };

                _sessionsById[sessionId] = session;

                var active = new ActiveSession
                {
                    SessionId = sessionId,
                    Session = session,
                    Buffer = new List<ActivitySample>(256),
                    SamplesFileFullPath = GetSamplesFileFullPath(session.samplesFile),
                };

                var startedAtMs = session.startedAt;
                active.SampleTimer = timer.Every(interval, () =>
                {
                    if (player == null || !player.IsConnected)
                    {
                        StopSoloSession(player?.userID ?? 0UL, "disconnect");
                        return;
                    }

                    var pos = player.transform.position;
                    var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    var tSec = (float)((nowMs - startedAtMs) / 1000.0);

                    var uv = WorldToUv(pos.x, pos.z, worldSize, mapScale, margin);
                    lock (active)
                    {
                        if (active.Stopped) return;
                        active.Session.sampleCount++;
                        active.Buffer.Add(new ActivitySample
                        {
                            t = tSec,
                            wx = pos.x,
                            wz = pos.z,
                            u = uv.u,
                            v = uv.v,
                        });
                    }
                });

                active.FlushTimer = timer.Every(flushInterval, () => FlushActive(active, finalFlush: false));

                _activeByPlayer[player.userID] = active;
            }

            player.ChatMessage($"[Solo] Запись началась: {sessionId}. Бегай/дерись, запись остановится при смерти. Стоп: /solostop");
        }

        private void StopSoloSession(ulong userId, string reason)
        {
            if (userId == 0) return;

            ActivitySession session = null;
            ActiveSession active = null;
            string sessionId = null;

            lock (_sync)
            {
                if (_activeByPlayer.TryGetValue(userId, out active) && active != null)
                {
                    sessionId = active.SessionId;
                    active.SampleTimer?.Destroy();
                    active.FlushTimer?.Destroy();
                    _activeByPlayer.Remove(userId);
                }

                if (!string.IsNullOrWhiteSpace(sessionId) && _sessionsById.TryGetValue(sessionId, out var s))
                {
                    session = s;
                    session.endedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    session.endReason = reason;
                }
            }

            if (active != null)
            {
                lock (active)
                {
                    active.Stopped = true;
                }
                FlushActive(active, finalFlush: true);
            }

            if (session != null)
            {
                SaveSession(session);
            }
        }

        private void OnEntityDeath(BaseCombatEntity entity, HitInfo info)
        {
            var player = entity as BasePlayer;
            if (player == null) return;

            ActiveSession active;
            ActivitySession session;
            lock (_sync)
            {
                if (!_activeByPlayer.TryGetValue(player.userID, out active) || active == null) return;
                if (!_sessionsById.TryGetValue(active.SessionId, out session) || session == null) return;
            }

            var pos = player.transform.position;
            var uv = WorldToUv(pos.x, pos.z, session.worldSize, session.mapScale, session.margin);
            lock (_sync)
            {
                session.deaths.Add(new DeathEvent
                {
                    at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    wx = pos.x,
                    wz = pos.z,
                    u = uv.u,
                    v = uv.v,
                });
            }

            StopSoloSession(player.userID, "death");
        }

        private void SaveSession(ActivitySession session)
        {
            try
            {
                Interface.Oxide.DataFileSystem.WriteObject($"SimpleMapGUI_session_{SanitizeId(session.id)}", session);
            }
            catch (Exception ex)
            {
                PrintError($"Failed to save session {session?.id}: {ex.Message}");
            }
        }

        private string EnsureSamplesFile(string sessionId)
        {
            try
            {
                var dir = Path.Combine(Interface.Oxide.DataDirectory, "SimpleMapGUI", "sessions");
                Directory.CreateDirectory(dir);
                var file = $"samples_{SanitizeId(sessionId)}.csv";
                var full = Path.Combine(dir, file);
                if (!File.Exists(full))
                {
                    File.WriteAllText(full, "t,wx,wz,u,v\n", Encoding.UTF8);
                }
                return Path.Combine("sessions", file);
            }
            catch (Exception ex)
            {
                PrintWarning($"Failed to create samples file: {ex.Message}");
                return null;
            }
        }

        private static string GetSamplesFileFullPath(string relative)
        {
            if (string.IsNullOrWhiteSpace(relative)) return null;
            return Path.Combine(Interface.Oxide.DataDirectory, "SimpleMapGUI", relative);
        }

        private void FlushActive(ActiveSession active, bool finalFlush)
        {
            if (active == null) return;

            List<ActivitySample> batch = null;
            string path = null;
            lock (active)
            {
                if (active.Buffer == null || active.Buffer.Count == 0) return;
                batch = new List<ActivitySample>(active.Buffer);
                active.Buffer.Clear();
                path = active.SamplesFileFullPath;
            }

            if (string.IsNullOrWhiteSpace(path)) return;

            try
            {
                using (var fs = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite))
                using (var sw = new StreamWriter(fs, Encoding.UTF8))
                {
                    var inv = System.Globalization.CultureInfo.InvariantCulture;
                    for (int i = 0; i < batch.Count; i++)
                    {
                        var p = batch[i];
                        sw.Write(p.t.ToString("0.###", inv)); sw.Write(',');
                        sw.Write(p.wx.ToString("0.###", inv)); sw.Write(',');
                        sw.Write(p.wz.ToString("0.###", inv)); sw.Write(',');
                        sw.Write(p.u.ToString("0.######", inv)); sw.Write(',');
                        sw.Write(p.v.ToString("0.######", inv));
                        sw.Write('\n');
                    }
                }
            }
            catch (Exception ex)
            {
                if (finalFlush) PrintWarning($"Failed to flush samples: {ex.Message}");
            }
        }

        private static string SanitizeId(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return "unknown";
            foreach (var c in Path.GetInvalidFileNameChars())
                id = id.Replace(c, '_');
            return id;
        }

        private string EnsureMapPng(uint seed, float worldSize, float mapScale)
        {
            try
            {
                var dir = Path.Combine(Interface.Oxide.DataDirectory, "SimpleMapGUI", "maps");
                Directory.CreateDirectory(dir);

                var file = $"map_{seed}_{(int)worldSize}_{mapScale:0.00}.png";
                var full = Path.Combine(dir, file);
                if (File.Exists(full)) return file;

                int w, h;
                Color bg;
                var bytes = MapImageRenderer.Render(out w, out h, out bg, mapScale, false);
                if (bytes == null || bytes.Length == 0) return null;

                File.WriteAllBytes(full, bytes);
                return file;
            }
            catch (Exception ex)
            {
                PrintWarning($"Failed to render/save map png: {ex.Message}");
                return null;
            }
        }

        private static Uv WorldToUv(float wx, float wz, float worldSize, float mapScale, int margin)
        {
            // Matches existing UI math: (margin + (pos + size/2) * scale) / (size*scale + margin*2)
            var mapPixelSize = worldSize * mapScale + margin * 2f;
            var u = (margin + (wx + worldSize / 2f) * mapScale) / mapPixelSize;
            var v = (margin + (wz + worldSize / 2f) * mapScale) / mapPixelSize;
            return new Uv { u = Mathf.Clamp01(u), v = Mathf.Clamp01(v) };
        }

        // ----------------------------
        // HTTP API for the website
        // ----------------------------

        private void StartHttp()
        {
            StopHttp();

            var host = _httpHost;
            var basePort = _httpPort;
            var autoFallback = Convert.ToBoolean(Config["AutoPortFallback"] ?? true);
            var attempts = Convert.ToInt32(Config["PortFallbackAttempts"] ?? 20);
            if (attempts < 0) attempts = 0;

            for (var i = 0; i <= attempts; i++)
            {
                var port = basePort + i;
                try
                {
                    _http = new HttpListener();
                    _http.Prefixes.Add($"http://{host}:{port}/");
                    _http.Start();

                    _httpPort = port;

                    _httpThread = new System.Threading.Thread(HttpLoop) { IsBackground = true };
                    _httpThread.Start();

                    if (i > 0)
                        PrintWarning($"HTTP port {basePort} is busy; using {port} instead.");

                    Puts($"HTTP API listening on http://{host}:{port}/ (endpoints: /simplemap/health, /simplemap/match/{{id}}, /simplemap/match/{{id}}/map.png)");
                    return;
                }
                catch (Exception ex)
                {
                    try
                    {
                        _http?.Stop();
                        _http?.Close();
                    }
                    catch
                    {
                        // ignore
                    }
                    finally
                    {
                        _http = null;
                    }

                    // If we are not allowed to fallback, fail immediately.
                    if (!autoFallback)
                    {
                        PrintWarning($"Failed to start HTTP API: {ex.Message}. Change HttpHost/HttpPort in config.");
                        return;
                    }

                    // Retry only for typical "address in use" cases; otherwise fail.
                    var msg = ex.Message ?? string.Empty;
                    var inUse = msg.IndexOf("Only one usage of each socket address", StringComparison.OrdinalIgnoreCase) >= 0
                        || msg.IndexOf("Address already in use", StringComparison.OrdinalIgnoreCase) >= 0
                        || msg.IndexOf("EADDRINUSE", StringComparison.OrdinalIgnoreCase) >= 0;

                    if (!inUse)
                    {
                        PrintWarning($"Failed to start HTTP API: {ex.Message}. Change HttpHost/HttpPort in config.");
                        return;
                    }

                    if (i >= attempts)
                    {
                        PrintWarning($"Failed to start HTTP API: all ports from {basePort} to {basePort + attempts} are busy.");
                        return;
                    }
                }
            }
        }

        private void StopHttp()
        {
            var thread = _httpThread;
            _httpThread = null;

            try
            {
                _http?.Stop();
                _http?.Close();
            }
            catch
            {
                // ignore
            }
            finally
            {
                _http = null;
            }

            try
            {
                if (thread != null && thread.IsAlive)
                    thread.Join(1000);
            }
            catch
            {
                // ignore
            }
        }

        private void HttpLoop()
        {
            while (_http != null && _http.IsListening)
            {
                try
                {
                    var ctx = _http.GetContext();
                    HandleHttp(ctx);
                }
                catch
                {
                    // listener stopped or errored
                }
            }
        }

        private void HandleHttp(HttpListenerContext ctx)
        {
            string method = null;
            string path = null;
            string remote = null;

            try
            {
                var req = ctx.Request;
                var res = ctx.Response;

                method = req.HttpMethod;
                path = (req.Url?.AbsolutePath ?? string.Empty).TrimEnd('/');
                remote = req.RemoteEndPoint != null ? req.RemoteEndPoint.ToString() : "?";

                res.Headers["Access-Control-Allow-Origin"] = "*";
                res.Headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
                res.Headers["Access-Control-Allow-Headers"] = "Content-Type";

                if (req.HttpMethod == "OPTIONS")
                {
                    res.StatusCode = 204;
                    res.Close();
                    return;
                }

                LogHttp($"{method} {path} from {remote}");

                if (string.Equals(path, "/simplemap/health", StringComparison.OrdinalIgnoreCase))
                {
                    WriteJson(res, $"{{\"ok\":true,\"plugin\":\"SimpleMapGUI\",\"version\":\"{Version}\",\"port\":{_httpPort}}}");
                    return;
                }

                // /simplemap/match/{id}
                if (path.StartsWith("/simplemap/match/", StringComparison.OrdinalIgnoreCase))
                {
                    var tail = path.Substring("/simplemap/match/".Length);
                    if (tail.EndsWith("/map.png", StringComparison.OrdinalIgnoreCase))
                    {
                        var id = tail.Substring(0, tail.Length - "/map.png".Length).Trim('/');
                        ServeMapPng(res, id);
                        return;
                    }
                    else
                    {
                        var id = tail.Trim('/');
                        ServeSessionJson(res, id);
                        return;
                    }
                }

                res.StatusCode = 404;
                LogHttp($"404 {path}");
                WriteText(res, "Not Found", "text/plain");
            }
            catch (Exception ex)
            {
                try
                {
                    ctx.Response.StatusCode = 500;
                    try
                    {
                        ctx.Response.Headers["Access-Control-Allow-Origin"] = "*";
                        ctx.Response.Headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
                        ctx.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
                    }
                    catch
                    {
                        // ignore
                    }

                    LogHttp($"500 {method ?? "?"} {path ?? "?"} from {remote ?? "?"} :: {ex.GetType().Name}: {ex.Message}");
                    PrintError($"HTTP handler error for {method ?? "?"} {path ?? "?"} from {remote ?? "?"}:\n{ex}");
                    WriteText(ctx.Response, "Internal Server Error", "text/plain");
                }
                catch
                {
                    // ignore
                }
            }
        }

        private void ServeSessionJson(HttpListenerResponse res, string id)
        {
            ActivitySession session = null;
            foreach (var candidate in MatchIdCandidates(id))
            {
                lock (_sync)
                {
                    if (_sessionsById.TryGetValue(candidate, out session) && session != null)
                        break;
                }

                if (session != null) break;

                try
                {
                    session = Interface.Oxide.DataFileSystem.ReadObject<ActivitySession>($"SimpleMapGUI_session_{SanitizeId(candidate)}");
                    if (session != null) break;
                }
                catch
                {
                    // ignore
                }
            }

            if (session == null)
            {
                res.StatusCode = 404;
                LogHttp($"match/{id} -> 404 not_found");
                WriteJson(res, "{\"error\":\"not_found\"}");
                return;
            }

            LogHttp($"match/{id} -> 200 sampleCount={session.sampleCount} deaths={(session.deaths?.Count ?? 0)}");

            // JsonUtility doesn't serialize lists of custom classes reliably in all Unity versions, so build manually.
            // We'll use a minimal manual JSON writer to keep it robust.
            WriteJson(res, BuildSessionJson(session));
        }

        private void ServeMapPng(HttpListenerResponse res, string id)
        {
            ActivitySession session = null;
            foreach (var candidate in MatchIdCandidates(id))
            {
                lock (_sync)
                {
                    if (_sessionsById.TryGetValue(candidate, out session) && session != null)
                        break;
                }

                if (session != null) break;

                try
                {
                    session = Interface.Oxide.DataFileSystem.ReadObject<ActivitySession>($"SimpleMapGUI_session_{SanitizeId(candidate)}");
                    if (session != null) break;
                }
                catch
                {
                    // ignore
                }
            }

            if (session == null || string.IsNullOrWhiteSpace(session.mapPngFile))
            {
                res.StatusCode = 404;
                LogHttp($"match/{id}/map.png -> 404 (no session/mapPngFile)");
                WriteText(res, "Map not found", "text/plain");
                return;
            }

            var full = Path.Combine(Interface.Oxide.DataDirectory, "SimpleMapGUI", "maps", session.mapPngFile);
            if (!File.Exists(full))
            {
                res.StatusCode = 404;
                LogHttp($"match/{id}/map.png -> 404 (file missing) {session.mapPngFile}");
                WriteText(res, "Map not found", "text/plain");
                return;
            }

            var bytes = File.ReadAllBytes(full);
            res.ContentType = "image/png";
            res.StatusCode = 200;
            LogHttp($"match/{id}/map.png -> 200 ({bytes.Length} bytes)");
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.OutputStream.Flush();
            res.Close();
        }

        private static void WriteJson(HttpListenerResponse res, string json)
        {
            WriteText(res, json, "application/json; charset=utf-8");
        }

        private static void WriteText(HttpListenerResponse res, string text, string contentType)
        {
            var bytes = Encoding.UTF8.GetBytes(text ?? string.Empty);
            res.ContentType = contentType;
            res.StatusCode = res.StatusCode == 0 ? 200 : res.StatusCode;
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.OutputStream.Flush();
            res.Close();
        }

        private static string BuildSessionJson(ActivitySession s)
        {
            var sb = new StringBuilder(64 * 1024);
            sb.Append('{');
            AppendJson(sb, "id", s.id).Append(',');
            AppendJson(sb, "playerId", s.playerId).Append(',');
            AppendJson(sb, "playerName", s.playerName).Append(',');
            sb.Append("\"seed\":").Append(s.seed).Append(',');
            sb.Append("\"worldSize\":").Append(s.worldSize.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"mapScale\":").Append(s.mapScale.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"margin\":").Append(s.margin).Append(',');
            sb.Append("\"startedAt\":").Append(s.startedAt).Append(',');
            sb.Append("\"endedAt\":").Append(s.endedAt).Append(',');
            AppendJson(sb, "endReason", s.endReason).Append(',');
            AppendJson(sb, "mapPngUrl", $"/simplemap/match/{Uri.EscapeDataString(s.id)}/map.png").Append(',');
            sb.Append("\"sampleCount\":").Append(s.sampleCount).Append(',');

            sb.Append("\"samples\":[");
            if (!string.IsNullOrWhiteSpace(s.samplesFile))
            {
                AppendSamplesFromFile(sb, s);
            }
            else if (s.samples != null)
            {
                for (var i = 0; i < s.samples.Count; i++)
                {
                    var p = s.samples[i];
                    if (i > 0) sb.Append(',');
                    AppendSampleJson(sb, p);
                }
            }
            sb.Append("],");

            sb.Append("\"deaths\":[");
            if (s.deaths != null)
            {
                for (var i = 0; i < s.deaths.Count; i++)
                {
                    var d = s.deaths[i];
                    if (i > 0) sb.Append(',');
                    sb.Append('{');
                    sb.Append("\"at\":").Append(d.at).Append(',');
                    sb.Append("\"wx\":").Append(d.wx.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
                    sb.Append("\"wz\":").Append(d.wz.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
                    sb.Append("\"u\":").Append(d.u.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
                    sb.Append("\"v\":").Append(d.v.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture));
                    sb.Append('}');
                }
            }
            sb.Append("]");

            sb.Append('}');
            return sb.ToString();
        }

        private static void AppendSampleJson(StringBuilder sb, ActivitySample p)
        {
            sb.Append('{');
            sb.Append("\"t\":").Append(p.t.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"wx\":").Append(p.wx.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"wz\":").Append(p.wz.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"u\":").Append(p.u.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"v\":").Append(p.v.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture));
            sb.Append('}');
        }

        private static void AppendSamplesFromFile(StringBuilder sb, ActivitySession s)
        {
            try
            {
                var full = Path.Combine(Interface.Oxide.DataDirectory, "SimpleMapGUI", s.samplesFile);
                if (!File.Exists(full)) return;

                var maxSamples = DefaultMaxSamplesToServe;
                var stride = 1;
                if (s.sampleCount > 0)
                {
                    stride = Math.Max(1, s.sampleCount / maxSamples);
                }

                var inv = System.Globalization.CultureInfo.InvariantCulture;
                var idx = -1;
                var written = 0;
                foreach (var line in File.ReadLines(full))
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    if (line.StartsWith("t,")) continue; // header
                    idx++;
                    if (stride > 1 && (idx % stride) != 0) continue;

                    var parts = line.Split(',');
                    if (parts.Length < 5) continue;

                    if (written > 0) sb.Append(',');
                    sb.Append('{');
                    sb.Append("\"t\":").Append(parts[0]).Append(',');
                    sb.Append("\"wx\":").Append(parts[1]).Append(',');
                    sb.Append("\"wz\":").Append(parts[2]).Append(',');
                    sb.Append("\"u\":").Append(parts[3]).Append(',');
                    sb.Append("\"v\":").Append(parts[4]);
                    sb.Append('}');
                    written++;

                    if (written >= maxSamples) break;
                }
            }
            catch
            {
                // ignore read/parse failures
            }
        }

        private static StringBuilder AppendJson(StringBuilder sb, string key, string value)
        {
            sb.Append('"').Append(Escape(key)).Append('"').Append(':');
            if (value == null)
            {
                sb.Append("null");
                return sb;
            }
            sb.Append('"').Append(Escape(value)).Append('"');
            return sb;
        }

        private static string Escape(string s)
        {
            if (string.IsNullOrEmpty(s)) return string.Empty;
            return s
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\n", "\\n")
                .Replace("\r", "\\r")
                .Replace("\t", "\\t");
        }

        string GetGridLetter(int i)
        {
             i++; 
             string text = "";
             while (i > 0)
             {
                 i--;
                 text = (char)('A' + i % 26) + text;
                 i /= 26;
             }
             return text;
        }

        private class ActiveSession
        {
            public string SessionId;
            public Oxide.Plugins.Timer SampleTimer;
            public Oxide.Plugins.Timer FlushTimer;
            public ActivitySession Session;
            public List<ActivitySample> Buffer;
            public string SamplesFileFullPath;
            public bool Stopped;
        }

        [Serializable]
        private class ActivitySession
        {
            public string id;
            public string playerId;
            public string playerName;

            public uint seed;
            public float worldSize;
            public float mapScale;
            public int margin;

            public long startedAt;
            public long endedAt;
            public string endReason;

            public string mapPngFile;

            public string samplesFile;
            public int sampleCount;

            public List<ActivitySample> samples;
            public List<DeathEvent> deaths;
        }

        [Serializable]
        private class ActivitySample
        {
            public float t;
            public float wx;
            public float wz;
            public float u;
            public float v;
        }

        [Serializable]
        private class DeathEvent
        {
            public long at;
            public float wx;
            public float wz;
            public float u;
            public float v;
        }

        private struct Uv
        {
            public float u;
            public float v;
        }
    }
}
