package local.worker.gateway;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

public final class WorkerGateway extends JavaPlugin implements PluginMessageListener {
  private static final String COMMAND_CHANNEL = "worker:command";
  private static final String REPLY_CHANNEL = "worker:reply";

  @Override public void onEnable() {
    getServer().getMessenger().registerOutgoingPluginChannel(this, COMMAND_CHANNEL);
    getServer().getMessenger().registerIncomingPluginChannel(this, REPLY_CHANNEL, this);
  }
  @Override public void onDisable() { getServer().getMessenger().unregisterIncomingPluginChannel(this); getServer().getMessenger().unregisterOutgoingPluginChannel(this); }

  @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (!(sender instanceof Player player)) { sender.sendMessage("Dieser Befehl ist nur im Spiel verfügbar."); return true; }
    if (!player.isOp()) { player.sendMessage("Dafür sind OP-Rechte erforderlich."); return true; }
    if (args.length == 0) { player.sendMessage("Verwendung: /worker <Befehl> [Argumente]"); return true; }
    JsonObject message = new JsonObject();
    message.addProperty("requestId", UUID.randomUUID().toString()); message.addProperty("playerUuid", player.getUniqueId().toString());
    message.addProperty("playerName", player.getName()); message.addProperty("world", player.getWorld().getKey().toString()); message.addProperty("command", args[0].toLowerCase());
    JsonObject position = new JsonObject(); position.addProperty("x", player.getLocation().getBlockX()); position.addProperty("y", player.getLocation().getBlockY()); position.addProperty("z", player.getLocation().getBlockZ()); message.add("position", position);
    message.add("args", new com.google.gson.Gson().toJsonTree(Arrays.copyOfRange(args, 1, args.length)));
    byte[] payload = message.toString().getBytes(StandardCharsets.UTF_8);
    String botName = getConfig().getString("bot-player-name", "WorkerBot");
    Player recipient = getServer().getPlayerExact(botName);
    if (recipient == null) { player.sendMessage("WorkerBot ist nicht verbunden."); return true; }
    recipient.sendPluginMessage(this, COMMAND_CHANNEL, payload);
    player.sendMessage("Worker-Befehl gesendet."); return true;
  }

  @Override public void onPluginMessageReceived(String channel, Player sender, byte[] data) {
    if (!REPLY_CHANNEL.equals(channel)) return;
    try {
      JsonObject reply = JsonParser.parseString(new String(data, StandardCharsets.UTF_8)).getAsJsonObject();
      Player recipient = getServer().getPlayer(UUID.fromString(reply.get("playerUuid").getAsString()));
      if (recipient != null) recipient.sendMessage("[Worker] " + reply.get("text").getAsString());
    } catch (Exception exception) { getLogger().warning("Ungültige Worker-Antwort: " + exception.getMessage()); }
  }
}
