import { AppError } from "./appError.js";

export class ValidationError extends AppError {
    constructor(message = "Invalid request") {
        super(message, 400);
    }
}