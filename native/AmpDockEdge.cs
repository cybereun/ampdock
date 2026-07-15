using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace AmpDockEdge
{
    internal static class Program
    {
        private static readonly Dictionary<string, string> Files = new Dictionary<string, string>
        {
            { "/", "src.index.html" }, { "/index.html", "src.index.html" }, { "/styles.css", "src.styles.css" },
            { "/renderer.js", "src.renderer.js" }, { "/edge-bridge.js", "native.edge-bridge.js" }, { "/lucide.js", "native.vendor.lucide.js" }
        };
        private static readonly Dictionary<string, PanelLayout> Layouts = new Dictionary<string, PanelLayout>
        {
            { "player", new PanelLayout(620, 264, 120, 110) },
            { "equalizer", new PanelLayout(620, 248, 120, 374) },
            { "playlist", new PanelLayout(620, 360, 120, 622) }
        };
        private static readonly object StateLock = new object();
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static readonly string StatePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AmpDock", "state.json");
        private static readonly string RuntimePortPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AmpDock", "runtime-port.txt");
        private static HttpListener Listener;
        private static string EdgePath;
        private static int Port;
        private static bool ShuttingDown;
        private static State State = NewState();

        [STAThread]
        private static int Main(string[] args)
        {
            EdgePath = FindEdge();
            if (Array.IndexOf(args, "--check-only") >= 0) return File.Exists(EdgePath) && ReadResource("src.index.html") != null ? 0 : 2;
            if (!File.Exists(EdgePath))
            {
                MessageBox.Show("Microsoft Edge was not found. AmpDock needs the Windows Edge runtime.", "AmpDock", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 2;
            }

            LoadState();
            Port = FindPort();
            Listener = new HttpListener();
            Listener.Prefixes.Add("http://127.0.0.1:" + Port + "/");
            Listener.Start();
            Directory.CreateDirectory(Path.GetDirectoryName(RuntimePortPath));
            File.WriteAllText(RuntimePortPath, Port.ToString(), Encoding.UTF8);
            ThreadPool.QueueUserWorkItem(_ => Serve());
            LaunchPanel("player");
            LaunchPanel("equalizer");
            LaunchPanel("playlist");
            Application.Run();
            return 0;
        }

        private static void LaunchPanel(string panel)
        {
            PanelLayout layout = Layouts[panel];
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AmpDock", "EdgeProfile", panel);
            Directory.CreateDirectory(profile);
            string url = "http://127.0.0.1:" + Port + "/?panel=" + panel;
            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = EdgePath;
            start.Arguments = "--app=\"" + url + "\" --new-window --user-data-dir=\"" + profile + "\" --no-first-run --disable-features=msEdgeSidebarV2 --window-size=" + layout.width + "," + layout.height + " --window-position=" + layout.x + "," + layout.y;
            start.UseShellExecute = false;
            Process.Start(start);
        }

        private static void Serve()
        {
            while (Listener != null && Listener.IsListening)
            {
                try { Handle(Listener.GetContext()); }
                catch (HttpListenerException) { return; }
                catch { }
            }
        }

        private static void Handle(HttpListenerContext context)
        {
            string path = context.Request.Url.AbsolutePath;
            if (path == "/api/state") { HandleState(context); return; }
            if (path == "/api/action") { HandleAction(context); return; }
            if (path == "/api/choose") { HandleChoose(context); return; }
            if (path == "/api/media") { HandleMedia(context); return; }
            if (path == "/api/window") { HandleWindow(context); return; }
            if (path == "/api/quit")
            {
                context.Response.StatusCode = 204; context.Response.Close(); ThreadPool.QueueUserWorkItem(_ => Shutdown()); return;
            }
            string resource;
            if (!Files.TryGetValue(path, out resource)) { context.Response.StatusCode = 404; context.Response.Close(); return; }
            string body = ReadResource(resource);
            if (body == null) { context.Response.StatusCode = 500; context.Response.Close(); return; }
            if (resource == "src.index.html") body = body.Replace("../node_modules/lucide/dist/umd/lucide.js", "lucide.js").Replace("connect-src 'none'", "connect-src 'self'");
            WriteText(context, body, ContentType(resource));
        }

        private static void HandleState(HttpListenerContext context)
        {
            if (context.Request.HttpMethod == "POST")
            {
                try
                {
                    using (StreamReader reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding))
                    {
                        State next = Json.Deserialize<State>(reader.ReadToEnd());
                        if (next != null) { Normalize(next); lock (StateLock) { next.playerActionType = State.playerActionType; next.playerActionIndex = State.playerActionIndex; next.playerActionRevision = State.playerActionRevision; State = next; } SaveState(); }
                    }
                }
                catch { context.Response.StatusCode = 400; context.Response.Close(); return; }
            }
            WriteJson(context, Snapshot());
        }

        private static void HandleAction(HttpListenerContext context)
        {
            try
            {
                using (StreamReader reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding))
                {
                    PlayerAction action = Json.Deserialize<PlayerAction>(reader.ReadToEnd());
                    if (action == null || String.IsNullOrEmpty(action.type)) throw new InvalidDataException();
                    lock (StateLock) { State.playerActionType = action.type; State.playerActionIndex = action.index; State.playerActionRevision++; }
                }
            }
            catch { context.Response.StatusCode = 400; context.Response.Close(); return; }
            WriteJson(context, Snapshot());
        }

        private static void HandleChoose(HttpListenerContext context)
        {
            bool folder = context.Request.QueryString["folder"] == "1";
            List<string> selected = PickAudio(folder);
            int added = 0;
            lock (StateLock)
            {
                HashSet<string> existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (Track track in State.tracks) existing.Add(track.path ?? "");
                foreach (string file in selected)
                {
                    if (!existing.Add(file)) continue;
                    State.tracks.Add(CreateTrack(file)); added++;
                }
                if (State.activeIndex < 0 && State.tracks.Count > 0) State.activeIndex = 0;
            }
            if (added > 0) SaveState();
            WriteJson(context, new ChooseResult { added = added, state = Snapshot() });
        }

        private static void HandleMedia(HttpListenerContext context)
        {
            string id = context.Request.QueryString["id"];
            string file = null;
            lock (StateLock) foreach (Track track in State.tracks) if (track.id == id) { file = track.path; break; }
            if (String.IsNullOrEmpty(file) || !File.Exists(file)) { context.Response.StatusCode = 404; context.Response.Close(); return; }
            FileInfo info = new FileInfo(file);
            long start = 0, end = info.Length - 1;
            string range = context.Request.Headers["Range"];
            if (!String.IsNullOrEmpty(range) && range.StartsWith("bytes="))
            {
                string[] parts = range.Substring(6).Split('-');
                long parsed;
                if (parts.Length > 0 && Int64.TryParse(parts[0], out parsed)) start = parsed;
                if (parts.Length > 1 && Int64.TryParse(parts[1], out parsed)) end = Math.Min(parsed, end);
                context.Response.StatusCode = 206;
                context.Response.AddHeader("Content-Range", "bytes " + start + "-" + end + "/" + info.Length);
            }
            long length = Math.Max(0, end - start + 1);
            context.Response.ContentType = MediaType(file); context.Response.AddHeader("Accept-Ranges", "bytes"); context.Response.ContentLength64 = length;
            using (FileStream input = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            {
                input.Position = start; byte[] buffer = new byte[65536]; long left = length;
                while (left > 0) { int read = input.Read(buffer, 0, (int)Math.Min(buffer.Length, left)); if (read == 0) break; context.Response.OutputStream.Write(buffer, 0, read); left -= read; }
            }
            context.Response.Close();
        }

        private static void HandleWindow(HttpListenerContext context)
        {
            string command = context.Request.QueryString["command"] ?? "";
            string target = context.Request.QueryString["target"] ?? "";
            if (command == "visibility" && Layouts.ContainsKey(target))
            {
                bool visible = context.Request.QueryString["visible"] == "1";
                IntPtr handle = FindPanel(target);
                if (handle == IntPtr.Zero && visible) LaunchPanel(target);
                else ShowWindow(handle, visible ? 5 : 0);
            }
            else if (command == "top") SetTopMost(context.Request.QueryString["value"] == "1");
            else if (command == "minimize") ShowWindow(FindPanel("player"), 6);
            else if (command == "reset") ResetLayout();
            context.Response.StatusCode = 204; context.Response.Close();
        }

        private static List<string> PickAudio(bool folder)
        {
            List<string> result = new List<string>(); ManualResetEvent done = new ManualResetEvent(false);
            Thread dialogThread = new Thread(() =>
            {
                try
                {
                    if (folder)
                    {
                        using (FolderBrowserDialog dialog = new FolderBrowserDialog()) if (dialog.ShowDialog() == DialogResult.OK)
                            foreach (string file in Directory.GetFiles(dialog.SelectedPath, "*.*", SearchOption.AllDirectories)) if (IsAudio(file)) result.Add(file);
                    }
                    else
                    {
                        using (OpenFileDialog dialog = new OpenFileDialog()) { dialog.Multiselect = true; dialog.Filter = "Audio files|*.mp3;*.wav;*.m4a;*.aac;*.flac;*.ogg;*.opus"; if (dialog.ShowDialog() == DialogResult.OK) result.AddRange(dialog.FileNames); }
                    }
                }
                catch { } finally { done.Set(); }
            });
            dialogThread.SetApartmentState(ApartmentState.STA); dialogThread.Start(); done.WaitOne(); return result;
        }

        private static State NewState() { return new State { tracks = new List<Track>(), activeIndex = -1, volume = 0.78, repeatMode = "off", eqEnabled = true, eqPreset = "flat", eqGains = new List<double> { 0,0,0,0,0,0,0,0,0,0 }, panelVisibility = new Dictionary<string, bool> { { "equalizer", true }, { "playlist", true } } }; }
        private static void Normalize(State value) { if (value.tracks == null) value.tracks = new List<Track>(); if (value.eqGains == null) value.eqGains = new List<double>(); if (value.panelVisibility == null) value.panelVisibility = new Dictionary<string, bool>(); if (!value.panelVisibility.ContainsKey("equalizer")) value.panelVisibility["equalizer"] = true; if (!value.panelVisibility.ContainsKey("playlist")) value.panelVisibility["playlist"] = true; foreach (Track track in value.tracks) track.url = "/api/media?id=" + Uri.EscapeDataString(track.id ?? ""); }
        private static State Snapshot() { lock (StateLock) { string raw = Json.Serialize(State); State copy = Json.Deserialize<State>(raw); Normalize(copy); return copy; } }
        private static Track CreateTrack(string path) { string name = Path.GetFileName(path); string stem = Path.GetFileNameWithoutExtension(path); int separator = stem.IndexOf(" - ", StringComparison.Ordinal); return new Track { id = Guid.NewGuid().ToString("N"), path = path, name = name, title = separator < 0 ? stem : stem.Substring(separator + 3), artist = separator < 0 ? "" : stem.Substring(0, separator), album = "", duration = 0, track = 0, cover = "" }; }
        private static void LoadState() { try { if (File.Exists(StatePath)) { State loaded = Json.Deserialize<State>(File.ReadAllText(StatePath)); Normalize(loaded); loaded.tracks.RemoveAll(track => String.IsNullOrEmpty(track.path) || !File.Exists(track.path)); State = loaded; } } catch { State = NewState(); } }
        private static void SaveState() { try { Directory.CreateDirectory(Path.GetDirectoryName(StatePath)); File.WriteAllText(StatePath, Json.Serialize(Snapshot()), Encoding.UTF8); } catch { } }
        private static bool IsAudio(string path) { string extension = Path.GetExtension(path).ToLowerInvariant(); return extension == ".mp3" || extension == ".wav" || extension == ".m4a" || extension == ".aac" || extension == ".flac" || extension == ".ogg" || extension == ".opus"; }
        private static string ReadResource(string name) { using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) { if (stream == null) return null; using (StreamReader reader = new StreamReader(stream, Encoding.UTF8)) return reader.ReadToEnd(); } }
        private static string ContentType(string name) { if (name.EndsWith(".css")) return "text/css; charset=utf-8"; if (name.EndsWith(".js")) return "application/javascript; charset=utf-8"; return "text/html; charset=utf-8"; }
        private static string MediaType(string file) { string ext = Path.GetExtension(file).ToLowerInvariant(); if (ext == ".mp3") return "audio/mpeg"; if (ext == ".wav") return "audio/wav"; if (ext == ".ogg" || ext == ".opus") return "audio/ogg"; if (ext == ".flac") return "audio/flac"; return "audio/mp4"; }
        private static void WriteJson(HttpListenerContext context, object value) { WriteText(context, Json.Serialize(value), "application/json; charset=utf-8"); }
        private static void WriteText(HttpListenerContext context, string text, string type) { byte[] bytes = Encoding.UTF8.GetBytes(text); context.Response.ContentType = type; context.Response.ContentLength64 = bytes.Length; context.Response.OutputStream.Write(bytes, 0, bytes.Length); context.Response.Close(); }
        private static int FindPort() { TcpListener listener = new TcpListener(System.Net.IPAddress.Loopback, 0); listener.Start(); int port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop(); return port; }
        private static string FindEdge() { string[] candidates = new string[] { Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe") }; foreach (string candidate in candidates) if (File.Exists(candidate)) return candidate; return ""; }

        private static IntPtr FindPanel(string panel) { string title = "AmpDock " + Char.ToUpper(panel[0]) + panel.Substring(1); foreach (Process process in Process.GetProcessesByName("msedge")) try { if (process.MainWindowTitle == title) return process.MainWindowHandle; } catch { } return IntPtr.Zero; }
        private static void SetTopMost(bool value) { foreach (string panel in Layouts.Keys) { IntPtr handle = FindPanel(panel); if (handle != IntPtr.Zero) SetWindowPos(handle, value ? new IntPtr(-1) : new IntPtr(-2), 0, 0, 0, 0, 0x0001 | 0x0002); } }
        private static void ResetLayout() { foreach (KeyValuePair<string, PanelLayout> item in Layouts) { IntPtr handle = FindPanel(item.Key); if (handle != IntPtr.Zero) SetWindowPos(handle, IntPtr.Zero, item.Value.x, item.Value.y, item.Value.width, item.Value.height, 0x0040); } }
        private static void Shutdown() { if (ShuttingDown) return; ShuttingDown = true; try { if (Listener != null) Listener.Stop(); } catch { } try { if (File.Exists(RuntimePortPath)) File.Delete(RuntimePortPath); } catch { } foreach (Process process in Process.GetProcessesByName("msedge")) try { if (process.MainWindowTitle.StartsWith("AmpDock", StringComparison.OrdinalIgnoreCase)) process.Kill(); } catch { } try { Application.Exit(); } catch { } }
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr handle, int command);
        [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr handle, IntPtr insertAfter, int x, int y, int cx, int cy, uint flags);
    }
    internal class PanelLayout { public int width, height, x, y; public PanelLayout(int width, int height, int x, int y) { this.width = width; this.height = height; this.x = x; this.y = y; } }
    internal class Track { public string id, path, name, title, artist, album, cover, url; public double duration; public int track; }
    internal class State { public List<Track> tracks; public int activeIndex; public double volume; public bool muted = false, shuffle = false, eqEnabled = true, alwaysOnTop = false; public string repeatMode = "off", eqPreset = "flat", playerActionType = ""; public int playerActionIndex = 0, playerActionRevision = 0; public List<double> eqGains; public Dictionary<string, bool> panelVisibility; }
    internal class ChooseResult { public int added; public State state; }
    internal class PlayerAction { public string type = ""; public int index = 0; }
}
