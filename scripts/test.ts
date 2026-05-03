import { NestFactory } from "@nestjs/core";
import { ScraperService } from "../apps/worker/src/service/scraper/scraper.service";
import { WorkerModule } from "../apps/worker/src/worker.module";

(async () => {
    const app = await NestFactory.createApplicationContext(WorkerModule);
    app.get(ScraperService);

    console.log("test")
})();