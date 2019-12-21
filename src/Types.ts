
export interface Notification {
	readonly jsonrpc: "2.0";
	readonly method: string;
	readonly params?: /*by-position*/Array<any> | /*by-name*/{ [namedParam: string]: any };
}
export interface Request extends Notification {
	readonly id: string | number;
}
export namespace Response {
	/**
	 * @see https://www.jsonrpc.org/specification#error_object
	 */
	export const enum ErrorCode {
		/**
		 * Invalid JSON was received by the server.
		 */
		ParseError = -32700,

		/**
		 * The JSON sent is not a valid Request object.
		 */
		InvalidRequest = -32600,

		/**
		 * 	The method does not exist / is not available.
		 */
		MethodNotFound = -32601,

		/**
		 * Invalid method parameter(s).
		 */
		InvalidParams = -32602,

		/**
		 * Internal JSON - RPC error.
		 */
		InternalError = -32603
	}
	export interface Base {
		readonly jsonrpc: "2.0";
		readonly id: string | number | null;
	}
	export interface Success extends Base {
		readonly result: any;
	}
	export interface Error extends Base {
		readonly code: number;
		readonly message: string;
		readonly data?: any;
	}
}
export type Response = Response.Success | Response.Error;

