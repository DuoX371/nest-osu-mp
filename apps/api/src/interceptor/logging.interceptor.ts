import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        const startTime = Date.now();

        return this.handleGql(context, next, startTime);
    }


    private handleGql(
        context: ExecutionContext,
        next: CallHandler,
        startTime: number,
    ): Observable<any> {
        const gqlCtx = GqlExecutionContext.create(context);
        const info = gqlCtx.getInfo();
        const args = gqlCtx.getArgs();
        const operationName = `${info.parentType.name}.${info.fieldName}`;

        if (info.parentType.name !== 'Query' && info.parentType.name !== 'Mutation') {
            return next.handle();
        }

        this.logger.log(`→ GQL ${operationName}`);

        if (args && Object.keys(args).length) {
            this.logger.debug(`  args: ${JSON.stringify(args)}`);
        }

        return next.handle().pipe(
            tap({
                next: (response) => {
                    const ms = Date.now() - startTime;
                    this.logger.log(`← GQL ${operationName} ${ms}ms`);
                    this.logger.debug(`  response: ${this.formatResponse(response)}`);
                },
                error: (err) => {
                    const ms = Date.now() - startTime;
                    this.logger.error(`← GQL ${operationName} ${ms}ms — ${err.message}`);
                },
            }),
        );
    }

    private formatResponse(response: any): string {
        if (response === null || response === undefined) {
            return 'null';
        }

        // array — log count + first item as sample
        if (Array.isArray(response)) {
            return `[${response.length} items] ${JSON.stringify(response[0])}... `;
        }

        // single object — log it fully
        return JSON.stringify(response);
    }
} 