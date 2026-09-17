package local.worker.gateway;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

public final class WorkerGateway extends JavaPlugin implements PluginMessageListener, TabCompleter {
  private static final String COMMAND_CHANNEL = "worker:command";
  private static final String REPLY_CHANNEL = "worker:reply";
  private static final String USAGE = "/worker <status|stop|equip|pos1|pos2|area|chest|patrol|guard|follow|deposit|find>";
  private static final List<String> COMMANDS = List.of("status", "stop", "equip", "pos1", "pos2", "area", "chest", "patrol", "guard", "follow", "deposit", "find");

  @Override public void onEnable() {
    getServer().getMessenger().registerOutgoingPluginChannel(this, COMMAND_CHANNEL);
    getServer().getMessenger().registerIncomingPluginChannel(this, REPLY_CHANNEL, this);
    getCommand("worker").setTabCompleter(this);
  }
  @Override public void onDisable() { getServer().getMessenger().unregisterIncomingPluginChannel(this); getServer().getMessenger().unregisterOutgoingPluginChannel(this); }

  @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (!(sender instanceof Player player)) { sender.sendMessage("Dieser Befehl ist nur im Spiel verfügbar."); return true; }
    if (!player.isOp()) { player.sendMessage("Dafür sind OP-Rechte erforderlich."); return true; }
    String validationError = validate(args);
    if (validationError != null) { player.sendMessage(validationError); return true; }
    JsonObject message = new JsonObject();
    message.addProperty("requestId", UUID.randomUUID().toString()); message.addProperty("playerUuid", player.getUniqueId().toString());
    message.addProperty("playerName", player.getName()); message.addProperty("world", player.getWorld().getKey().toString()); message.addProperty("command", args[0].toLowerCase(Locale.ROOT));
    JsonObject position = new JsonObject(); position.addProperty("x", player.getLocation().getBlockX()); position.addProperty("y", player.getLocation().getBlockY()); position.addProperty("z", player.getLocation().getBlockZ()); message.add("position", position);
    message.add("args", new com.google.gson.Gson().toJsonTree(Arrays.copyOfRange(args, 1, args.length)));
    byte[] payload = message.toString().getBytes(StandardCharsets.UTF_8);
    String botName = getConfig().getString("bot-player-name", "WorkerBot");
    Player recipient = getServer().getPlayerExact(botName);
    if (recipient == null) { player.sendMessage("WorkerBot ist nicht verbunden."); return true; }
    recipient.sendPluginMessage(this, COMMAND_CHANNEL, payload);
    player.sendMessage("Worker-Befehl gesendet."); return true;
  }

  private String validate(String[] args) {
    if (args.length == 0 || !COMMANDS.contains(args[0].toLowerCase(Locale.ROOT))) return "Verwendung: " + USAGE;
    String command = args[0].toLowerCase(Locale.ROOT);
    if (List.of("status", "stop", "equip", "pos1", "pos2").contains(command)) return args.length == 1 ? null : "Dieser Worker-Befehl hat keine Argumente.";
    if (command.equals("area")) return args.length == 4 && args[1].equalsIgnoreCase("save") && List.of("guard", "farm", "forest").contains(args[2].toLowerCase(Locale.ROOT)) ? null : "Verwendung: /worker area save <guard|farm|forest> <name>";
    if (command.equals("chest")) return args.length == 3 && args[1].equalsIgnoreCase("set") ? null : "Verwendung: /worker chest set <name>";
    if (List.of("patrol", "guard").contains(command)) return (args.length == 2 || args.length == 3) && args[1].equalsIgnoreCase("stop") || (args.length == 3 && args[1].equalsIgnoreCase("start")) ? null : "Verwendung: /worker " + command + " <start <area>|stop [area]>";
    if (command.equals("follow")) return args.length <= 2 ? null : "Verwendung: /worker follow [spieler]|stop";
    if (command.equals("deposit")) return args.length == 3 && args[1].equalsIgnoreCase("wood") ? null : "Verwendung: /worker deposit wood <chest>";
    if (args.length < 2 || args.length > 3) return "Verwendung: /worker find <resource> [radius]";
    if (args.length == 3) try { int radius = Integer.parseInt(args[2]); if (radius < 1 || radius > 128) return "Der Radius muss zwischen 1 und 128 liegen."; } catch (NumberFormatException exception) { return "Der Radius muss eine ganze Zahl sein."; }
    return null;
  }

  @Override public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
    if (!(sender instanceof Player player) || !player.isOp()) return List.of();
    if (args.length == 1) return complete(args[0], COMMANDS);
    String root = args[0].toLowerCase(Locale.ROOT);
    if (args.length == 2 && root.equals("area")) return complete(args[1], List.of("save"));
    if (args.length == 3 && root.equals("area") && args[1].equalsIgnoreCase("save")) return complete(args[2], List.of("guard", "farm", "forest"));
    if (args.length == 2 && root.equals("chest")) return complete(args[1], List.of("set"));
    if (args.length == 2 && (root.equals("patrol") || root.equals("guard"))) return complete(args[1], List.of("start", "stop"));
    if (args.length == 2 && root.equals("follow")) return complete(args[1], List.of("stop"));
    if (args.length == 2 && root.equals("deposit")) return complete(args[1], List.of("wood"));
    return List.of();
  }

  private List<String> complete(String input, List<String> choices) { return choices.stream().filter(choice -> choice.startsWith(input.toLowerCase(Locale.ROOT))).toList(); }

  @Override public void onPluginMessageReceived(String channel, Player sender, byte[] data) {
    if (!REPLY_CHANNEL.equals(channel)) return;
    try {
      JsonObject reply = JsonParser.parseString(new String(data, StandardCharsets.UTF_8)).getAsJsonObject();
      Player recipient = getServer().getPlayer(UUID.fromString(reply.get("playerUuid").getAsString()));
      if (recipient != null) recipient.sendMessage("[Worker] " + reply.get("text").getAsString());
    } catch (Exception exception) { getLogger().warning("Ungültige Worker-Antwort: " + exception.getMessage()); }
  }
}
