import { AppError } from "./appError.js";

export class InternalServerError extends AppError {
    constructor(message = "Internal server error.") {
        super(message, 500)
    }
}