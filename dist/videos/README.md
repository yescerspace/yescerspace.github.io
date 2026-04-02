# Video assets (local)

Place video files here (e.g. `.mp4`, `.webm`) and reference them in React with the shared helper:

```ts
import { publicAsset } from "@/utils/publicAsset";

const src = publicAsset("videos/your-reel.mp4");
```

Use `<video src={src} />` or your preferred player. No external hosting required.
