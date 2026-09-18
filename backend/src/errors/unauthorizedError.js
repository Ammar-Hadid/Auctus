import { AppError } from "./appError.js";

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401)
    }
}
