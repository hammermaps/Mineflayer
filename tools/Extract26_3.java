import com.google.gson.*;
import java.nio.file.*;
import net.minecraft.SharedConstants;
import net.minecraft.server.Bootstrap;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.EmptyBlockGetter;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.Property;
import net.minecraft.world.phys.AABB;

/** Offline extraction from the official 26.3 server, compiled and run with OpenJDK 26. */
public class Extract26_3 {
  public static void main(String[] args) throws Exception {
    SharedConstants.tryDetectVersion();
    Bootstrap.bootStrap();
    JsonObject root = new JsonObject();
    JsonArray blocks = new JsonArray();
    JsonObject shapes = new JsonObject();
    for (Block block : BuiltInRegistries.BLOCK) {
      String name = BuiltInRegistries.BLOCK.getKey(block).getPath();
      BlockState state = block.defaultBlockState();
      JsonObject b = new JsonObject();
      b.addProperty("name", name);
      b.addProperty("id", BuiltInRegistries.BLOCK.getId(block));
      b.addProperty("hardness", state.getDestroySpeed(EmptyBlockGetter.INSTANCE, BlockPos.ZERO));
      b.addProperty("resistance", block.getExplosionResistance());
      b.addProperty("transparent", !state.canOcclude());
      b.addProperty("emitLight", state.getLightEmission());
      b.addProperty("filterLight", state.getLightDampening());
      b.addProperty("defaultState", Block.getId(state));
      b.addProperty("itemId", BuiltInRegistries.ITEM.getId(block.asItem()));
      JsonArray properties = new JsonArray();
      for (Property<?> property : block.getStateDefinition().getProperties()) {
        JsonObject p = new JsonObject();
        p.addProperty("name", property.getName());
        p.addProperty("type", property.getValueClass() == Boolean.class ? "bool" : property.getValueClass() == Integer.class ? "int" : "enum");
        p.addProperty("num_values", property.getPossibleValues().size());
        JsonArray values = new JsonArray();
        for (Object value : property.getPossibleValues()) values.add(value.toString().toLowerCase(java.util.Locale.ROOT));
        if (property.getValueClass() != Boolean.class) p.add("values", values);
        properties.add(p);
      }
      b.add("states", properties);
      b.addProperty("minStateId", Block.getId(block.getStateDefinition().getPossibleStates().getFirst()));
      b.addProperty("maxStateId", Block.getId(block.getStateDefinition().getPossibleStates().getLast()));
      for (BlockState s : block.getStateDefinition().getPossibleStates()) {
        JsonArray boxes = new JsonArray();
        for (AABB box : s.getCollisionShape(EmptyBlockGetter.INSTANCE, BlockPos.ZERO).toAabbs()) {
          JsonArray coordinates = new JsonArray();
          for (double v : new double[]{box.minX, box.minY, box.minZ, box.maxX, box.maxY, box.maxZ}) coordinates.add(v);
          boxes.add(coordinates);
        }
        shapes.add(Integer.toString(Block.getId(s)), boxes);
      }
      blocks.add(b);
    }
    root.add("blocks", blocks);
    root.add("shapes", shapes);
    JsonArray entities = new JsonArray();
    BuiltInRegistries.ENTITY_TYPE.forEach(type -> {
      JsonObject entity = new JsonObject();
      entity.addProperty("name", BuiltInRegistries.ENTITY_TYPE.getKey(type).getPath());
      entity.addProperty("id", BuiltInRegistries.ENTITY_TYPE.getId(type));
      entity.addProperty("width", type.getWidth());
      entity.addProperty("height", type.getHeight());
      entities.add(entity);
    });
    root.add("entities", entities);
    Files.writeString(Path.of(args[0]), new GsonBuilder().setPrettyPrinting().create().toJson(root) + "\n");
  }
}
