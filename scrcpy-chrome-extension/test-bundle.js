var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@yume-chan/async/esm/promise-resolver.js
var PromiseResolver = class {
  #promise;
  get promise() {
    return this.#promise;
  }
  #resolve;
  #reject;
  #state = "running";
  get state() {
    return this.#state;
  }
  constructor() {
    this.#promise = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }
  resolve = (value) => {
    this.#resolve(value);
    this.#state = "resolved";
  };
  reject = (reason) => {
    this.#reject(reason);
    this.#state = "rejected";
  };
};

// node_modules/@yume-chan/async/esm/async-operation-manager.js
var AsyncOperationManager = class {
  nextId;
  pendingResolvers = /* @__PURE__ */ new Map();
  constructor(startId = 0) {
    this.nextId = startId;
  }
  add() {
    const id = this.nextId++;
    const resolver = new PromiseResolver();
    this.pendingResolvers.set(id, resolver);
    return [id, resolver.promise];
  }
  getResolver(id) {
    if (!this.pendingResolvers.has(id)) {
      return null;
    }
    const resolver = this.pendingResolvers.get(id);
    this.pendingResolvers.delete(id);
    return resolver;
  }
  resolve(id, result) {
    const resolver = this.getResolver(id);
    if (resolver !== null) {
      resolver.resolve(result);
      return true;
    }
    return false;
  }
  reject(id, reason) {
    const resolver = this.getResolver(id);
    if (resolver !== null) {
      resolver.reject(reason);
      return true;
    }
    return false;
  }
};

// node_modules/@yume-chan/async/esm/delay.js
function delay(time) {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve(), time);
  });
}

// node_modules/@yume-chan/async/esm/maybe-promise.js
function isPromiseLike(value) {
  return typeof value === "object" && value !== null && "then" in value;
}

// node_modules/@yume-chan/struct/esm/bipedal.js
function advance(iterator, next) {
  while (true) {
    const { done, value } = iterator.next(next);
    if (done) {
      return value;
    }
    if (isPromiseLike(value)) {
      return value.then((value2) => advance(iterator, { resolved: value2 }), (error) => advance(iterator, { error }));
    }
    next = value;
  }
}
// @__NO_SIDE_EFFECTS__
function bipedal(fn, bindThis) {
  function result(...args) {
    const iterator = fn.call(this, function* (value) {
      if (isPromiseLike(value)) {
        const result2 = yield value;
        if ("resolved" in result2) {
          return result2.resolved;
        } else {
          throw result2.error;
        }
      }
      return value;
    }, ...args);
    return advance(iterator, void 0);
  }
  if (bindThis) {
    return result.bind(bindThis);
  } else {
    return result;
  }
}

// node_modules/@yume-chan/struct/esm/field/serialize.js
function defaultFieldSerializer(serializer) {
  return (source, context) => {
    if ("buffer" in context) {
      const buffer2 = serializer(source, context);
      context.buffer.set(buffer2, context.index);
      return buffer2.length;
    } else {
      return serializer(source, context);
    }
  };
}
function byobFieldSerializer(size, serializer) {
  return (source, context) => {
    if ("buffer" in context) {
      context.index ??= 0;
      serializer(source, context);
      return size;
    } else {
      const buffer2 = new Uint8Array(size);
      serializer(source, {
        buffer: buffer2,
        index: 0,
        littleEndian: context.littleEndian
      });
      return buffer2;
    }
  };
}

// node_modules/@yume-chan/struct/esm/field/factory.js
// @__NO_SIDE_EFFECTS__
function _field(size, type, serialize, deserialize, options) {
  const field2 = {
    size,
    type,
    serialize: type === "default" ? defaultFieldSerializer(serialize) : byobFieldSerializer(size, serialize),
    deserialize: bipedal(deserialize),
    omitInit: options?.omitInit
  };
  if (options?.init) {
    field2.init = options.init;
  }
  return field2;
}
var field = _field;

// node_modules/@yume-chan/struct/esm/buffer.js
var EmptyUint8Array = new Uint8Array(0);
function copyMaybeDifferentLength(dest, source, index, length) {
  if (source.length < length) {
    dest.set(source, index);
    dest.fill(0, index + source.length, index + length);
  } else if (source.length === length) {
    dest.set(source, index);
  } else {
    dest.set(source.subarray(0, length), index);
  }
}
// @__NO_SIDE_EFFECTS__
function buffer(lengthOrField, converter) {
  if (typeof lengthOrField === "number") {
    let serialize;
    let deserialize2;
    let init2;
    if (lengthOrField === 0) {
      serialize = () => {
      };
      if (converter) {
        deserialize2 = function* () {
          return converter.convert(EmptyUint8Array);
        };
      } else {
        deserialize2 = function* () {
          return EmptyUint8Array;
        };
      }
    } else {
      serialize = (value, { buffer: buffer2, index }) => copyMaybeDifferentLength(buffer2, value, index, lengthOrField);
      if (converter) {
        deserialize2 = function* (then, reader) {
          const array = reader.readExactly(lengthOrField);
          return converter.convert(yield* then(array));
        };
        init2 = (value) => converter.back(value);
      } else {
        deserialize2 = function* (_then, reader) {
          const array = reader.readExactly(lengthOrField);
          return array;
        };
      }
    }
    return field(lengthOrField, "byob", serialize, deserialize2, { init: init2 });
  }
  if ((typeof lengthOrField === "object" || typeof lengthOrField === "function") && "serialize" in lengthOrField) {
    let deserialize2;
    let init2;
    if (converter) {
      deserialize2 = function* (then, reader, context) {
        const length = yield* then(lengthOrField.deserialize(reader, context));
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return converter.convert(yield* then(array));
      };
      init2 = (value) => converter.back(value);
    } else {
      deserialize2 = function* (then, reader, context) {
        const length = yield* then(lengthOrField.deserialize(reader, context));
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return array;
      };
    }
    return field(lengthOrField.size, "default", (value, { littleEndian }) => {
      if (lengthOrField.type === "default") {
        const lengthBuffer = lengthOrField.serialize(value.length, {
          littleEndian
        });
        if (value.length === 0) {
          return lengthBuffer;
        }
        const result = new Uint8Array(lengthBuffer.length + value.length);
        result.set(lengthBuffer, 0);
        result.set(value, lengthBuffer.length);
        return result;
      } else {
        const result = new Uint8Array(lengthOrField.size + value.length);
        lengthOrField.serialize(value.length, {
          buffer: result,
          index: 0,
          littleEndian
        });
        result.set(value, lengthOrField.size);
        return result;
      }
    }, deserialize2, { init: init2 });
  }
  if (typeof lengthOrField === "string") {
    let deserialize2;
    let init2;
    if (converter) {
      deserialize2 = function* (then, reader, { dependencies }) {
        const length = dependencies[lengthOrField];
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return converter.convert(yield* then(array));
      };
      init2 = (value, dependencies) => {
        const array = converter.back(value);
        dependencies[lengthOrField] = array.length;
        return array;
      };
    } else {
      deserialize2 = function* (_then, reader, { dependencies }) {
        const length = dependencies[lengthOrField];
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return array;
      };
      init2 = (value, dependencies) => {
        const array = value;
        dependencies[lengthOrField] = array.length;
        return array;
      };
    }
    return field(0, "default", (source) => source, deserialize2, { init: init2 });
  }
  let deserialize;
  let init;
  if (converter) {
    deserialize = function* (then, reader, { dependencies }) {
      const rawLength = dependencies[lengthOrField.field];
      const length = lengthOrField.convert(rawLength);
      const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
      return converter.convert(yield* then(array));
    };
    init = (value, dependencies) => {
      const array = converter.back(value);
      dependencies[lengthOrField.field] = lengthOrField.back(array.length);
      return array;
    };
  } else {
    deserialize = function* (_then, reader, { dependencies }) {
      const rawLength = dependencies[lengthOrField.field];
      const length = lengthOrField.convert(rawLength);
      const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
      return array;
    };
    init = (value, dependencies) => {
      const array = value;
      dependencies[lengthOrField.field] = lengthOrField.back(array.length);
      return array;
    };
  }
  return field(0, "default", (source) => source, deserialize, { init });
}

// node_modules/@yume-chan/struct/esm/readable.js
var ExactReadableEndedError = class extends Error {
  constructor() {
    super("ExactReadable ended");
  }
};

// node_modules/@yume-chan/struct/esm/struct.js
var StructDeserializeError = class extends Error {
  constructor(message) {
    super(message);
  }
};
var StructNotEnoughDataError = class extends StructDeserializeError {
  constructor() {
    super("The underlying readable was ended before the struct was fully deserialized");
  }
};
var StructEmptyError = class extends StructDeserializeError {
  constructor() {
    super("The underlying readable doesn't contain any more struct");
  }
};
// @__NO_SIDE_EFFECTS__
function struct(fields, options) {
  const fieldList = Object.entries(fields);
  let size = 0;
  let byob = true;
  for (const [, field2] of fieldList) {
    size += field2.size;
    if (byob && field2.type !== "byob") {
      byob = false;
    }
  }
  const littleEndian = options.littleEndian;
  const extra = options.extra ? Object.getOwnPropertyDescriptors(options.extra) : void 0;
  return {
    littleEndian,
    fields,
    extra: options.extra,
    type: byob ? "byob" : "default",
    size,
    serialize(source, bufferOrContext) {
      const temp = { ...source };
      for (const [key, field2] of fieldList) {
        if (key in temp && "init" in field2) {
          const result = field2.init?.(temp[key], temp);
          temp[key] = result;
        }
      }
      const sizes = new Array(fieldList.length);
      const buffers = new Array(fieldList.length);
      {
        const context2 = { littleEndian };
        for (const [index2, [key, field2]] of fieldList.entries()) {
          if (field2.type === "byob") {
            sizes[index2] = field2.size;
          } else {
            buffers[index2] = field2.serialize(temp[key], context2);
            sizes[index2] = buffers[index2].length;
          }
        }
      }
      const size2 = sizes.reduce((sum, size3) => sum + size3, 0);
      let externalBuffer;
      let buffer2;
      let index;
      if (bufferOrContext instanceof Uint8Array) {
        if (bufferOrContext.length < size2) {
          throw new Error("Buffer too small");
        }
        externalBuffer = true;
        buffer2 = bufferOrContext;
        index = 0;
      } else if (typeof bufferOrContext === "object" && "buffer" in bufferOrContext) {
        externalBuffer = true;
        buffer2 = bufferOrContext.buffer;
        index = bufferOrContext.index ?? 0;
        if (buffer2.length - index < size2) {
          throw new Error("Buffer too small");
        }
      } else {
        externalBuffer = false;
        buffer2 = new Uint8Array(size2);
        index = 0;
      }
      const context = {
        buffer: buffer2,
        index,
        littleEndian
      };
      for (const [index2, [key, field2]] of fieldList.entries()) {
        if (buffers[index2]) {
          buffer2.set(buffers[index2], context.index);
        } else {
          field2.serialize(temp[key], context);
        }
        context.index += sizes[index2];
      }
      if (externalBuffer) {
        return size2;
      } else {
        return buffer2;
      }
    },
    deserialize: bipedal(function* (then, reader) {
      const startPosition = reader.position;
      const result = {};
      const context = {
        dependencies: result,
        littleEndian
      };
      try {
        for (const [key, field2] of fieldList) {
          result[key] = yield* then(field2.deserialize(reader, context));
        }
      } catch (e) {
        if (!(e instanceof ExactReadableEndedError)) {
          throw e;
        }
        if (reader.position === startPosition) {
          throw new StructEmptyError();
        } else {
          throw new StructNotEnoughDataError();
        }
      }
      if (extra) {
        Object.defineProperties(result, extra);
      }
      if (options.postDeserialize) {
        return options.postDeserialize.call(result, result);
      } else {
        return result;
      }
    })
  };
}

// node_modules/@yume-chan/struct/esm/extend.js
// @__NO_SIDE_EFFECTS__
function extend(base, fields, options) {
  return struct(Object.assign({}, base.fields, fields), {
    littleEndian: options?.littleEndian ?? base.littleEndian,
    extra: base.extra,
    postDeserialize: options?.postDeserialize
  });
}

// node_modules/@yume-chan/no-data-view/esm/int32.js
// @__NO_SIDE_EFFECTS__
function getInt32(buffer2, offset, littleEndian) {
  return littleEndian ? buffer2[offset] | buffer2[offset + 1] << 8 | buffer2[offset + 2] << 16 | buffer2[offset + 3] << 24 : buffer2[offset] << 24 | buffer2[offset + 1] << 16 | buffer2[offset + 2] << 8 | buffer2[offset + 3];
}
function setInt32(buffer2, offset, value, littleEndian) {
  if (littleEndian) {
    buffer2[offset] = value;
    buffer2[offset + 1] = value >> 8;
    buffer2[offset + 2] = value >> 16;
    buffer2[offset + 3] = value >> 24;
  } else {
    buffer2[offset] = value >> 24;
    buffer2[offset + 1] = value >> 16;
    buffer2[offset + 2] = value >> 8;
    buffer2[offset + 3] = value;
  }
}

// node_modules/@yume-chan/no-data-view/esm/int64.js
function setInt64LittleEndian(buffer2, offset, value) {
  buffer2[offset] = Number(value & 0xffn);
  buffer2[offset + 1] = Number(value >> 8n & 0xffn);
  buffer2[offset + 2] = Number(value >> 16n & 0xffn);
  buffer2[offset + 3] = Number(value >> 24n & 0xffn);
  buffer2[offset + 4] = Number(value >> 32n & 0xffn);
  buffer2[offset + 5] = Number(value >> 40n & 0xffn);
  buffer2[offset + 6] = Number(value >> 48n & 0xffn);
  buffer2[offset + 7] = Number(value >> 56n & 0xffn);
}
function setInt64BigEndian(buffer2, offset, value) {
  buffer2[offset] = Number(value >> 56n & 0xffn);
  buffer2[offset + 1] = Number(value >> 48n & 0xffn);
  buffer2[offset + 2] = Number(value >> 40n & 0xffn);
  buffer2[offset + 3] = Number(value >> 32n & 0xffn);
  buffer2[offset + 4] = Number(value >> 24n & 0xffn);
  buffer2[offset + 5] = Number(value >> 16n & 0xffn);
  buffer2[offset + 6] = Number(value >> 8n & 0xffn);
  buffer2[offset + 7] = Number(value & 0xffn);
}

// node_modules/@yume-chan/no-data-view/esm/uint32.js
// @__NO_SIDE_EFFECTS__
function getUint32LittleEndian(buffer2, offset) {
  return (buffer2[offset] | buffer2[offset + 1] << 8 | buffer2[offset + 2] << 16 | buffer2[offset + 3] << 24) >>> 0;
}
// @__NO_SIDE_EFFECTS__
function getUint32(buffer2, offset, littleEndian) {
  return littleEndian ? (buffer2[offset] | buffer2[offset + 1] << 8 | buffer2[offset + 2] << 16 | buffer2[offset + 3] << 24) >>> 0 : (buffer2[offset] << 24 | buffer2[offset + 1] << 16 | buffer2[offset + 2] << 8 | buffer2[offset + 3]) >>> 0;
}
function setUint32LittleEndian(buffer2, offset, value) {
  buffer2[offset] = value;
  buffer2[offset + 1] = value >> 8;
  buffer2[offset + 2] = value >> 16;
  buffer2[offset + 3] = value >> 24;
}
function setUint32(buffer2, offset, value, littleEndian) {
  if (littleEndian) {
    buffer2[offset] = value;
    buffer2[offset + 1] = value >> 8;
    buffer2[offset + 2] = value >> 16;
    buffer2[offset + 3] = value >> 24;
  } else {
    buffer2[offset] = value >> 24;
    buffer2[offset + 1] = value >> 16;
    buffer2[offset + 2] = value >> 8;
    buffer2[offset + 3] = value;
  }
}

// node_modules/@yume-chan/no-data-view/esm/uint64.js
function getUint64BigEndian(buffer2, offset) {
  return BigInt(buffer2[offset]) << 56n | BigInt(buffer2[offset + 1]) << 48n | BigInt(buffer2[offset + 2]) << 40n | BigInt(buffer2[offset + 3]) << 32n | BigInt(buffer2[offset + 4]) << 24n | BigInt(buffer2[offset + 5]) << 16n | BigInt(buffer2[offset + 6]) << 8n | BigInt(buffer2[offset + 7]);
}

// node_modules/@yume-chan/struct/esm/number.js
// @__NO_SIDE_EFFECTS__
function number(size, serialize, deserialize) {
  const fn = (() => fn);
  Object.assign(fn, field(size, "byob", serialize, deserialize));
  return fn;
}
var u32 = /* @__PURE__ */ number(4, (value, { buffer: buffer2, index, littleEndian }) => {
  setUint32(buffer2, index, value, littleEndian);
}, function* (then, reader, { littleEndian }) {
  const data = yield* then(reader.readExactly(4));
  return getUint32(data, 0, littleEndian);
});
var s32 = /* @__PURE__ */ number(4, (value, { buffer: buffer2, index, littleEndian }) => {
  setInt32(buffer2, index, value, littleEndian);
}, function* (then, reader, { littleEndian }) {
  const data = yield* then(reader.readExactly(4));
  return getInt32(data, 0, littleEndian);
});

// node_modules/@yume-chan/struct/esm/utils.js
var { TextEncoder, TextDecoder } = globalThis;
var SharedEncoder = /* @__PURE__ */ new TextEncoder();
var SharedDecoder = /* @__PURE__ */ new TextDecoder();
// @__NO_SIDE_EFFECTS__
function encodeUtf8(input) {
  return SharedEncoder.encode(input);
}
// @__NO_SIDE_EFFECTS__
function decodeUtf8(buffer2) {
  return SharedDecoder.decode(buffer2);
}

// node_modules/@yume-chan/stream-extra/esm/stream.js
var { AbortController } = globalThis;
var ReadableStream = /* @__PURE__ */ (() => {
  const { ReadableStream: ReadableStream2 } = globalThis;
  if (!ReadableStream2.from) {
    ReadableStream2.from = function(iterable) {
      const iterator = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
      return new ReadableStream2({
        async pull(controller) {
          const result = await iterator.next();
          if (result.done) {
            controller.close();
            return;
          }
          controller.enqueue(result.value);
        },
        async cancel(reason) {
          await iterator.return?.(reason);
        }
      });
    };
  }
  if (!ReadableStream2.prototype[Symbol.asyncIterator] || !ReadableStream2.prototype.values) {
    ReadableStream2.prototype.values = async function* (options) {
      const reader = this.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            return;
          }
          yield value;
        }
      } finally {
        if (!options?.preventCancel) {
          await reader.cancel();
        }
        reader.releaseLock();
      }
    };
    ReadableStream2.prototype[Symbol.asyncIterator] = // eslint-disable-next-line @typescript-eslint/unbound-method
    ReadableStream2.prototype.values;
  }
  return ReadableStream2;
})();
var { WritableStream, TransformStream } = globalThis;

// node_modules/@yume-chan/stream-extra/esm/task-queue.js
var TaskQueue = class {
  #ready;
  #disposed = false;
  enqueue(task, bail = false) {
    if (this.#disposed) {
      throw new Error("TaskQueue is disposed");
    }
    if (!this.#ready) {
      try {
        const result2 = task();
        if (isPromiseLike(result2)) {
          this.#ready = result2.then(() => {
          }, (e) => {
            if (bail) {
              throw e;
            }
          });
        }
        return result2;
      } catch (e) {
        if (bail) {
          const promise = Promise.reject(e);
          void promise.catch(() => {
          });
          this.#ready = promise;
        }
        throw e;
      }
    }
    const result = this.#ready.then(() => {
      if (this.#disposed) {
        throw new Error("TaskQueue is disposed");
      }
      return task();
    });
    this.#ready = result.then(() => {
    }, (e) => {
      if (bail || this.#disposed) {
        throw e;
      }
    });
    return result;
  }
  dispose() {
    this.#disposed = true;
  }
};

// node_modules/@yume-chan/stream-extra/esm/push-readable.js
var PushReadableStream = class extends ReadableStream {
  /**
   * Create a new `PushReadableStream` from a source.
   *
   * @param source If `source` returns a `Promise`, the stream will be closed
   * when the `Promise` is resolved, and be errored when the `Promise` is rejected.
   * @param strategy
   */
  constructor(source, strategy, logger) {
    let controller;
    const tasks = new TaskQueue();
    let zeroHighWaterMarkAllowEnqueue = false;
    let waterMarkLow;
    const abortController = new AbortController();
    let stopped = false;
    const enqueue = (chunk) => {
      logger?.({
        source: "producer",
        operation: "enqueue",
        value: chunk,
        phase: "start"
      });
      if (abortController.signal.aborted) {
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "ignored"
        });
        return false;
      }
      if (controller.desiredSize === null) {
        controller.enqueue(chunk);
        throw new Error("unreachable");
      }
      if (zeroHighWaterMarkAllowEnqueue) {
        zeroHighWaterMarkAllowEnqueue = false;
        controller.enqueue(chunk);
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "complete"
        });
        return true;
      }
      if (controller.desiredSize <= 0) {
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "waiting"
        });
        waterMarkLow = new PromiseResolver();
        return waterMarkLow.promise.then(() => {
          controller.enqueue(chunk);
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "complete"
          });
          return true;
        }, () => {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "ignored"
          });
          return false;
        });
      }
      controller.enqueue(chunk);
      logger?.({
        source: "producer",
        operation: "enqueue",
        value: chunk,
        phase: "complete"
      });
      return true;
    };
    const close = (explicit) => {
      logger?.({
        source: "producer",
        operation: "close",
        explicit,
        phase: "start"
      });
      if (abortController.signal.aborted || stopped && !explicit) {
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "ignored"
        });
        return;
      }
      controller.close();
      stopped = true;
      waterMarkLow?.reject();
      logger?.({
        source: "producer",
        operation: "close",
        explicit,
        phase: "complete"
      });
    };
    const error = (error2, explicit) => {
      logger?.({
        source: "producer",
        operation: "error",
        explicit,
        phase: "start"
      });
      stopped = true;
      controller.error(error2);
      waterMarkLow?.reject();
      logger?.({
        source: "producer",
        operation: "error",
        explicit,
        phase: "complete"
      });
    };
    super({
      start: (controller_) => {
        controller = controller_;
        const result = source({
          abortSignal: abortController.signal,
          enqueue: async (chunk) => (
            // Run `enqueue`s in serial
            // Use `async/await` to always return a `Promise`
            await tasks.enqueue(() => enqueue(chunk))
          ),
          close() {
            close(true);
          },
          error(e) {
            error(e, true);
          }
        });
        if (!stopped && isPromiseLike(result)) {
          result.then(() => close(false), (e) => error(e, false));
        }
      },
      pull: () => {
        logger?.({
          source: "consumer",
          operation: "pull",
          phase: "start"
        });
        if (waterMarkLow) {
          waterMarkLow.resolve(void 0);
          waterMarkLow = void 0;
        } else if (strategy?.highWaterMark === 0) {
          zeroHighWaterMarkAllowEnqueue = true;
        }
        logger?.({
          source: "consumer",
          operation: "pull",
          phase: "complete"
        });
      },
      cancel: (reason) => {
        logger?.({
          source: "consumer",
          operation: "cancel",
          phase: "start"
        });
        stopped = true;
        abortController.abort(reason);
        waterMarkLow?.reject();
        logger?.({
          source: "consumer",
          operation: "cancel",
          phase: "complete"
        });
      }
    }, strategy);
  }
};

// node_modules/@yume-chan/stream-extra/esm/consumable/readable.js
var ConsumableReadableStream = class _ConsumableReadableStream extends ReadableStream {
  static async enqueue(controller, chunk) {
    const output = new Consumable(chunk);
    controller.enqueue(output);
    await output.consumed;
  }
  constructor(source, strategy) {
    let wrappedController;
    let wrappedStrategy;
    if (strategy) {
      wrappedStrategy = {};
      if ("highWaterMark" in strategy) {
        wrappedStrategy.highWaterMark = strategy.highWaterMark;
      }
      if ("size" in strategy) {
        wrappedStrategy.size = (chunk) => {
          return strategy.size(chunk.value);
        };
      }
    }
    super({
      start(controller) {
        wrappedController = {
          enqueue(chunk) {
            return _ConsumableReadableStream.enqueue(controller, chunk);
          },
          close() {
            controller.close();
          },
          error(reason) {
            controller.error(reason);
          }
        };
        return source.start?.(wrappedController);
      },
      pull() {
        return source.pull?.(wrappedController);
      },
      cancel(reason) {
        return source.cancel?.(reason);
      }
    }, wrappedStrategy);
  }
};

// node_modules/@yume-chan/stream-extra/esm/consumable/wrap-byte-readable.js
var ConsumableWrapByteReadableStream = class extends ReadableStream {
  constructor(stream, chunkSize, min) {
    const reader = stream.getReader({ mode: "byob" });
    let array = new Uint8Array(chunkSize);
    super({
      async pull(controller) {
        const { done, value } = await reader.read(array, { min });
        if (done) {
          controller.close();
          return;
        }
        await ConsumableReadableStream.enqueue(controller, value);
        array = new Uint8Array(value.buffer);
      },
      cancel(reason) {
        return reader.cancel(reason);
      }
    });
  }
};

// node_modules/@yume-chan/stream-extra/esm/consumable/wrap-writable.js
var ConsumableWrapWritableStream = class extends WritableStream {
  constructor(stream) {
    const writer = stream.getWriter();
    super({
      write(chunk) {
        return chunk.tryConsume((chunk2) => writer.write(chunk2));
      },
      abort(reason) {
        return writer.abort(reason);
      },
      close() {
        return writer.close();
      }
    });
  }
};

// node_modules/@yume-chan/stream-extra/esm/consumable/writable.js
var ConsumableWritableStream = class extends WritableStream {
  static async write(writer, value) {
    const consumable = new Consumable(value);
    await writer.write(consumable);
    await consumable.consumed;
  }
  constructor(sink, strategy) {
    let wrappedStrategy;
    if (strategy) {
      wrappedStrategy = {};
      if ("highWaterMark" in strategy) {
        wrappedStrategy.highWaterMark = strategy.highWaterMark;
      }
      if ("size" in strategy) {
        wrappedStrategy.size = (chunk) => {
          return strategy.size(chunk instanceof Consumable ? chunk.value : chunk);
        };
      }
    }
    super({
      start(controller) {
        return sink.start?.(controller);
      },
      write(chunk, controller) {
        return chunk.tryConsume((chunk2) => sink.write?.(chunk2, controller));
      },
      abort(reason) {
        return sink.abort?.(reason);
      },
      close() {
        return sink.close?.();
      }
    }, wrappedStrategy);
  }
};

// node_modules/@yume-chan/stream-extra/esm/task.js
var { console: console2 } = globalThis;
var createTask = /* @__PURE__ */ (() => console2?.createTask?.bind(console2) ?? (() => ({
  run(callback) {
    return callback();
  }
})))();

// node_modules/@yume-chan/stream-extra/esm/consumable.js
var Consumable = class {
  static WritableStream = ConsumableWritableStream;
  static WrapWritableStream = ConsumableWrapWritableStream;
  static ReadableStream = ConsumableReadableStream;
  static WrapByteReadableStream = ConsumableWrapByteReadableStream;
  #task;
  #resolver;
  value;
  consumed;
  constructor(value) {
    this.#task = createTask("Consumable");
    this.value = value;
    this.#resolver = new PromiseResolver();
    this.consumed = this.#resolver.promise;
  }
  consume() {
    this.#resolver.resolve();
  }
  error(error) {
    this.#resolver.reject(error);
  }
  tryConsume(callback) {
    try {
      let result = this.#task.run(() => callback(this.value));
      if (isPromiseLike(result)) {
        result = result.then((value) => {
          this.#resolver.resolve();
          return value;
        }, (e) => {
          this.#resolver.reject(e);
          throw e;
        });
      } else {
        this.#resolver.resolve();
      }
      return result;
    } catch (e) {
      this.#resolver.reject(e);
      throw e;
    }
  }
};

// node_modules/@yume-chan/stream-extra/esm/maybe-consumable/index.js
var maybe_consumable_exports = {};
__export(maybe_consumable_exports, {
  WrapWritableStream: () => MaybeConsumableWrapWritableStream,
  WritableStream: () => MaybeConsumableWritableStream,
  getValue: () => getValue,
  tryConsume: () => tryConsume
});

// node_modules/@yume-chan/stream-extra/esm/maybe-consumable/utils.js
function getValue(value) {
  return value instanceof Consumable ? value.value : value;
}
function tryConsume(value, callback) {
  if (value instanceof Consumable) {
    return value.tryConsume(callback);
  } else {
    return callback(value);
  }
}

// node_modules/@yume-chan/stream-extra/esm/maybe-consumable/wrap-writable.js
var MaybeConsumableWrapWritableStream = class extends WritableStream {
  constructor(stream) {
    const writer = stream.getWriter();
    super({
      write(chunk) {
        return tryConsume(chunk, (chunk2) => writer.write(chunk2));
      },
      abort(reason) {
        return writer.abort(reason);
      },
      close() {
        return writer.close();
      }
    });
  }
};

// node_modules/@yume-chan/stream-extra/esm/maybe-consumable/writable.js
var MaybeConsumableWritableStream = class extends WritableStream {
  constructor(sink, strategy) {
    let wrappedStrategy;
    if (strategy) {
      wrappedStrategy = {};
      if ("highWaterMark" in strategy) {
        wrappedStrategy.highWaterMark = strategy.highWaterMark;
      }
      if ("size" in strategy) {
        wrappedStrategy.size = (chunk) => {
          return strategy.size(chunk instanceof Consumable ? chunk.value : chunk);
        };
      }
    }
    super({
      start(controller) {
        return sink.start?.(controller);
      },
      write(chunk, controller) {
        return tryConsume(chunk, (chunk2) => sink.write?.(chunk2, controller));
      },
      abort(reason) {
        return sink.abort?.(reason);
      },
      close() {
        return sink.close?.();
      }
    }, wrappedStrategy);
  }
};

// node_modules/@yume-chan/adb/esm/utils/base64.js
var [charToIndex, indexToChar, paddingChar] = /* @__PURE__ */ (() => {
  const charToIndex2 = [];
  const indexToChar2 = [];
  const paddingChar2 = "=".charCodeAt(0);
  function addRange(start, end) {
    const charCodeStart = start.charCodeAt(0);
    const charCodeEnd = end.charCodeAt(0);
    for (let charCode = charCodeStart; charCode <= charCodeEnd; charCode += 1) {
      charToIndex2[charCode] = indexToChar2.length;
      indexToChar2.push(charCode);
    }
  }
  addRange("A", "Z");
  addRange("a", "z");
  addRange("0", "9");
  addRange("+", "+");
  addRange("/", "/");
  return [charToIndex2, indexToChar2, paddingChar2];
})();
function calculateBase64EncodedLength(inputLength) {
  const remainder = inputLength % 3;
  const paddingLength = remainder !== 0 ? 3 - remainder : 0;
  return [(inputLength + paddingLength) / 3 * 4, paddingLength];
}
function encodeBase64(input, output) {
  const [outputLength, paddingLength] = calculateBase64EncodedLength(input.length);
  if (!output) {
    output = new Uint8Array(outputLength);
    encodeForward(input, output, paddingLength);
    return output;
  } else {
    if (output.length < outputLength) {
      throw new TypeError("output buffer is too small");
    }
    output = output.subarray(0, outputLength);
    if (input.buffer !== output.buffer) {
      encodeForward(input, output, paddingLength);
    } else if (output.byteOffset + output.length - (paddingLength + 1) <= input.byteOffset + input.length) {
      encodeForward(input, output, paddingLength);
    } else if (output.byteOffset >= input.byteOffset - 1) {
      encodeBackward(input, output, paddingLength);
    } else {
      throw new TypeError("input and output cannot overlap");
    }
    return outputLength;
  }
}
function encodeForward(input, output, paddingLength) {
  let inputIndex = 0;
  let outputIndex = 0;
  while (inputIndex < input.length - 2) {
    const x = input[inputIndex];
    inputIndex += 1;
    const y = input[inputIndex];
    inputIndex += 1;
    const z = input[inputIndex];
    inputIndex += 1;
    output[outputIndex] = indexToChar[x >> 2];
    outputIndex += 1;
    output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
    outputIndex += 1;
    output[outputIndex] = indexToChar[(y & 15) << 2 | z >> 6];
    outputIndex += 1;
    output[outputIndex] = indexToChar[z & 63];
    outputIndex += 1;
  }
  if (paddingLength === 2) {
    const x = input[inputIndex];
    output[outputIndex] = indexToChar[x >> 2];
    outputIndex += 1;
    output[outputIndex] = indexToChar[(x & 3) << 4];
    outputIndex += 1;
    output[outputIndex] = paddingChar;
    outputIndex += 1;
    output[outputIndex] = paddingChar;
  } else if (paddingLength === 1) {
    const x = input[inputIndex];
    inputIndex += 1;
    const y = input[inputIndex];
    output[outputIndex] = indexToChar[x >> 2];
    outputIndex += 1;
    output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
    outputIndex += 1;
    output[outputIndex] = indexToChar[(y & 15) << 2];
    outputIndex += 1;
    output[outputIndex] = paddingChar;
  }
}
function encodeBackward(input, output, paddingLength) {
  let inputIndex = input.length - 1;
  let outputIndex = output.length - 1;
  if (paddingLength === 2) {
    const x = input[inputIndex];
    inputIndex -= 1;
    output[outputIndex] = paddingChar;
    outputIndex -= 1;
    output[outputIndex] = paddingChar;
    outputIndex -= 1;
    output[outputIndex] = indexToChar[(x & 3) << 4];
    outputIndex -= 1;
    output[outputIndex] = indexToChar[x >> 2];
    outputIndex -= 1;
  } else if (paddingLength === 1) {
    const y = input[inputIndex];
    inputIndex -= 1;
    const x = input[inputIndex];
    inputIndex -= 1;
    output[outputIndex] = paddingChar;
    outputIndex -= 1;
    output[outputIndex] = indexToChar[(y & 15) << 2];
    outputIndex -= 1;
    output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
    outputIndex -= 1;
    output[outputIndex] = indexToChar[x >> 2];
    outputIndex -= 1;
  }
  while (inputIndex >= 0) {
    const z = input[inputIndex];
    inputIndex -= 1;
    const y = input[inputIndex];
    inputIndex -= 1;
    const x = input[inputIndex];
    inputIndex -= 1;
    output[outputIndex] = indexToChar[z & 63];
    outputIndex -= 1;
    output[outputIndex] = indexToChar[(y & 15) << 2 | z >> 6];
    outputIndex -= 1;
    output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
    outputIndex -= 1;
    output[outputIndex] = indexToChar[x >> 2];
    outputIndex -= 1;
  }
}

// node_modules/@yume-chan/adb/esm/features.js
var AdbFeature = {
  ShellV2: "shell_v2",
  Cmd: "cmd",
  StatV2: "stat_v2",
  ListV2: "ls_v2",
  FixedPushMkdir: "fixed_push_mkdir",
  Abb: "abb",
  AbbExec: "abb_exec",
  SendReceiveV2: "sendrecv_v2",
  DelayedAck: "delayed_ack"
};

// node_modules/@yume-chan/adb/esm/banner.js
var AdbBannerKey = {
  Product: "ro.product.name",
  Model: "ro.product.model",
  Device: "ro.product.device",
  Features: "features"
};
var AdbBanner = class _AdbBanner {
  static parse(banner) {
    let state;
    let product;
    let model;
    let device;
    let features = [];
    const pieces = banner.split("::");
    if (pieces.length > 1) {
      state = pieces[0].trim() || void 0;
      const props = pieces[1];
      for (const prop of props.split(";")) {
        if (!prop) {
          continue;
        }
        const keyValue = prop.split("=");
        if (keyValue.length !== 2) {
          continue;
        }
        const [key, value] = keyValue;
        switch (key) {
          case AdbBannerKey.Product:
            product = value;
            break;
          case AdbBannerKey.Model:
            model = value;
            break;
          case AdbBannerKey.Device:
            device = value;
            break;
          case AdbBannerKey.Features:
            features = value.split(",");
            break;
        }
      }
    }
    return new _AdbBanner(state, product, model, device, features);
  }
  #state;
  get state() {
    return this.#state;
  }
  #product;
  get product() {
    return this.#product;
  }
  #model;
  get model() {
    return this.#model;
  }
  #device;
  get device() {
    return this.#device;
  }
  #features = [];
  get features() {
    return this.#features;
  }
  // eslint-disable-next-line @typescript-eslint/max-params
  constructor(state, product, model, device, features) {
    this.#state = state;
    this.#product = product;
    this.#model = model;
    this.#device = device;
    this.#features = features;
  }
};

// node_modules/@yume-chan/adb/esm/daemon/crypto.js
function getBigUint(array, byteOffset, length) {
  let result = 0n;
  for (let i = byteOffset; i < byteOffset + length; i += 8) {
    result <<= 64n;
    const value = getUint64BigEndian(array, i);
    result |= value;
  }
  return result;
}
function setBigUint(array, byteOffset, length, value, littleEndian) {
  if (littleEndian) {
    while (value > 0n) {
      setInt64LittleEndian(array, byteOffset, value);
      byteOffset += 8;
      value >>= 64n;
    }
  } else {
    let position = byteOffset + length - 8;
    while (value > 0n) {
      setInt64BigEndian(array, position, value);
      position -= 8;
      value >>= 64n;
    }
  }
}
var RsaPrivateKeyNOffset = 38;
var RsaPrivateKeyNLength = 2048 / 8;
var RsaPrivateKeyDOffset = 303;
var RsaPrivateKeyDLength = 2048 / 8;
function rsaParsePrivateKey(key) {
  const n = getBigUint(key, RsaPrivateKeyNOffset, RsaPrivateKeyNLength);
  const d = getBigUint(key, RsaPrivateKeyDOffset, RsaPrivateKeyDLength);
  return [n, d];
}
function nonNegativeMod(m, d) {
  const r = m % d;
  if (r > 0) {
    return r;
  }
  return r + (d > 0 ? d : -d);
}
function modInverse(a, m) {
  a = nonNegativeMod(a, m);
  if (!a || m < 2) {
    return NaN;
  }
  const s = [];
  let b = m;
  while (b) {
    [a, b] = [b, a % b];
    s.push({ a, b });
  }
  if (a !== 1) {
    return NaN;
  }
  let x = 1;
  let y = 0;
  for (let i = s.length - 2; i >= 0; i -= 1) {
    [x, y] = [y, x - y * Math.floor(s[i].a / s[i].b)];
  }
  return nonNegativeMod(y, m);
}
var ModulusLengthInBytes = 2048 / 8;
var ModulusLengthInWords = ModulusLengthInBytes / 4;
function adbGetPublicKeySize() {
  return 4 + 4 + ModulusLengthInBytes + ModulusLengthInBytes + 4;
}
function adbGeneratePublicKey(privateKey, output) {
  let outputType;
  const outputLength = adbGetPublicKeySize();
  if (!output) {
    output = new Uint8Array(outputLength);
    outputType = "Uint8Array";
  } else {
    if (output.length < outputLength) {
      throw new TypeError("output buffer is too small");
    }
    outputType = "number";
  }
  const outputView = new DataView(output.buffer, output.byteOffset, output.length);
  let outputOffset = 0;
  outputView.setUint32(outputOffset, ModulusLengthInWords, true);
  outputOffset += 4;
  const [n] = rsaParsePrivateKey(privateKey);
  const n0inv = -modInverse(Number(n % 2n ** 32n), 2 ** 32);
  outputView.setInt32(outputOffset, n0inv, true);
  outputOffset += 4;
  setBigUint(output, outputOffset, ModulusLengthInBytes, n, true);
  outputOffset += ModulusLengthInBytes;
  const rr = 2n ** 4096n % n;
  setBigUint(output, outputOffset, ModulusLengthInBytes, rr, true);
  outputOffset += ModulusLengthInBytes;
  outputView.setUint32(outputOffset, 65537, true);
  if (outputType === "Uint8Array") {
    return output;
  } else {
    return outputLength;
  }
}
function powMod(base, exponent, modulus) {
  if (modulus === 1n) {
    return 0n;
  }
  let r = 1n;
  base = base % modulus;
  while (exponent > 0n) {
    if (BigInt.asUintN(1, exponent) === 1n) {
      r = r * base % modulus;
    }
    base = base * base % modulus;
    exponent >>= 1n;
  }
  return r;
}
var SHA1_DIGEST_LENGTH = 20;
var ASN1_SEQUENCE = 48;
var ASN1_OCTET_STRING = 4;
var ASN1_NULL = 5;
var ASN1_OID = 6;
var SHA1_DIGEST_INFO = new Uint8Array([
  ASN1_SEQUENCE,
  13 + SHA1_DIGEST_LENGTH,
  ASN1_SEQUENCE,
  9,
  // SHA-1 (1 3 14 3 2 26)
  ASN1_OID,
  5,
  1 * 40 + 3,
  14,
  3,
  2,
  26,
  ASN1_NULL,
  0,
  ASN1_OCTET_STRING,
  SHA1_DIGEST_LENGTH
]);
function rsaSign(privateKey, data) {
  const [n, d] = rsaParsePrivateKey(privateKey);
  const padded = new Uint8Array(256);
  let index = 0;
  padded[index] = 0;
  index += 1;
  padded[index] = 1;
  index += 1;
  const fillLength = padded.length - SHA1_DIGEST_INFO.length - data.length - 1;
  while (index < fillLength) {
    padded[index] = 255;
    index += 1;
  }
  padded[index] = 0;
  index += 1;
  padded.set(SHA1_DIGEST_INFO, index);
  index += SHA1_DIGEST_INFO.length;
  padded.set(data, index);
  const signature = powMod(getBigUint(padded, 0, padded.length), d, n);
  setBigUint(padded, 0, padded.length, signature, false);
  return padded;
}

// node_modules/@yume-chan/adb/esm/daemon/packet.js
var AdbCommand = {
  Auth: 1213486401,
  // 'AUTH'
  Close: 1163086915,
  // 'CLSE'
  Connect: 1314410051,
  // 'CNXN'
  Okay: 1497451343,
  // 'OKAY'
  Open: 1313165391,
  // 'OPEN'
  Write: 1163154007
  // 'WRTE'
};
var AdbPacketHeader = struct({
  command: u32,
  arg0: u32,
  arg1: u32,
  payloadLength: u32,
  checksum: u32,
  magic: s32
}, { littleEndian: true });
var AdbPacket = extend(AdbPacketHeader, {
  payload: buffer("payloadLength")
});
function calculateChecksum(payload) {
  return payload.reduce((result, item) => result + item, 0);
}

// node_modules/@yume-chan/adb/esm/daemon/auth.js
var AdbAuthType = {
  Token: 1,
  Signature: 2,
  PublicKey: 3
};
var AdbSignatureAuthenticator = async function* (credentialStore, getNextRequest) {
  for await (const key of credentialStore.iterateKeys()) {
    const packet = await getNextRequest();
    if (packet.arg0 !== AdbAuthType.Token) {
      return;
    }
    const signature = rsaSign(key.buffer, packet.payload);
    yield {
      command: AdbCommand.Auth,
      arg0: AdbAuthType.Signature,
      arg1: 0,
      payload: signature
    };
  }
};
var AdbPublicKeyAuthenticator = async function* (credentialStore, getNextRequest) {
  const packet = await getNextRequest();
  if (packet.arg0 !== AdbAuthType.Token) {
    return;
  }
  let privateKey;
  for await (const key of credentialStore.iterateKeys()) {
    privateKey = key;
    break;
  }
  if (!privateKey) {
    privateKey = await credentialStore.generateKey();
  }
  const publicKeyLength = adbGetPublicKeySize();
  const [publicKeyBase64Length] = calculateBase64EncodedLength(publicKeyLength);
  const nameBuffer = privateKey.name?.length ? encodeUtf8(privateKey.name) : EmptyUint8Array;
  const publicKeyBuffer = new Uint8Array(publicKeyBase64Length + (nameBuffer.length ? nameBuffer.length + 1 : 0) + // Space character + name
  1);
  adbGeneratePublicKey(privateKey.buffer, publicKeyBuffer);
  encodeBase64(publicKeyBuffer.subarray(0, publicKeyLength), publicKeyBuffer);
  if (nameBuffer.length) {
    publicKeyBuffer[publicKeyBase64Length] = 32;
    publicKeyBuffer.set(nameBuffer, publicKeyBase64Length + 1);
  }
  yield {
    command: AdbCommand.Auth,
    arg0: AdbAuthType.PublicKey,
    arg1: 0,
    payload: publicKeyBuffer
  };
};
var ADB_DEFAULT_AUTHENTICATORS = [
  AdbSignatureAuthenticator,
  AdbPublicKeyAuthenticator
];
var AdbAuthenticationProcessor = class {
  authenticators;
  #credentialStore;
  #pendingRequest = new PromiseResolver();
  #iterator;
  constructor(authenticators, credentialStore) {
    this.authenticators = authenticators;
    this.#credentialStore = credentialStore;
  }
  #getNextRequest = () => {
    return this.#pendingRequest.promise;
  };
  async *#invokeAuthenticator() {
    for (const authenticator of this.authenticators) {
      for await (const packet of authenticator(this.#credentialStore, this.#getNextRequest)) {
        this.#pendingRequest = new PromiseResolver();
        yield packet;
      }
    }
  }
  async process(packet) {
    if (!this.#iterator) {
      this.#iterator = this.#invokeAuthenticator();
    }
    this.#pendingRequest.resolve(packet);
    const result = await this.#iterator.next();
    if (result.done) {
      throw new Error("No authenticator can handle the request");
    }
    return result.value;
  }
  dispose() {
    void this.#iterator?.return?.();
  }
};

// node_modules/@yume-chan/adb/esm/daemon/socket.js
var AdbDaemonSocketController = class {
  #dispatcher;
  localId;
  remoteId;
  localCreated;
  service;
  #readable;
  #readableController;
  get readable() {
    return this.#readable;
  }
  #writableController;
  writable;
  #closed = false;
  #closedPromise = new PromiseResolver();
  get closed() {
    return this.#closedPromise.promise;
  }
  #socket;
  get socket() {
    return this.#socket;
  }
  #availableWriteBytesChanged;
  /**
   * When delayed ack is disabled, returns `Infinity` if the socket is ready to write
   * (exactly one packet can be written no matter how large it is), or `-1` if the socket
   * is waiting for ack message.
   *
   * When delayed ack is enabled, returns a non-negative finite number indicates the number of
   * bytes that can be written to the socket before waiting for ack message.
   */
  #availableWriteBytes = 0;
  constructor(options) {
    this.#dispatcher = options.dispatcher;
    this.localId = options.localId;
    this.remoteId = options.remoteId;
    this.localCreated = options.localCreated;
    this.service = options.service;
    this.#readable = new PushReadableStream((controller) => {
      this.#readableController = controller;
    });
    this.writable = new maybe_consumable_exports.WritableStream({
      start: (controller) => {
        this.#writableController = controller;
        controller.signal.addEventListener("abort", () => {
          this.#availableWriteBytesChanged?.reject(controller.signal.reason);
        });
      },
      write: async (data) => {
        const size = data.length;
        const chunkSize = this.#dispatcher.options.maxPayloadSize;
        for (let start = 0, end = chunkSize; start < size; start = end, end += chunkSize) {
          const chunk = data.subarray(start, end);
          await this.#writeChunk(chunk);
        }
      }
    });
    this.#socket = new AdbDaemonSocket(this);
    this.#availableWriteBytes = options.availableWriteBytes;
  }
  async #writeChunk(data) {
    const length = data.length;
    while (this.#availableWriteBytes < length) {
      const resolver = new PromiseResolver();
      this.#availableWriteBytesChanged = resolver;
      await resolver.promise;
    }
    if (this.#availableWriteBytes === Infinity) {
      this.#availableWriteBytes = -1;
    } else {
      this.#availableWriteBytes -= length;
    }
    await this.#dispatcher.sendPacket(AdbCommand.Write, this.localId, this.remoteId, data);
  }
  async enqueue(data) {
    await this.#readableController.enqueue(data);
  }
  ack(bytes) {
    this.#availableWriteBytes += bytes;
    this.#availableWriteBytesChanged?.resolve();
  }
  async close() {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#availableWriteBytesChanged?.reject(new Error("Socket closed"));
    try {
      this.#writableController.error(new Error("Socket closed"));
    } catch {
    }
    await this.#dispatcher.sendPacket(AdbCommand.Close, this.localId, this.remoteId, EmptyUint8Array);
  }
  dispose() {
    this.#readableController.close();
    this.#closedPromise.resolve(void 0);
  }
};
var AdbDaemonSocket = class {
  #controller;
  get localId() {
    return this.#controller.localId;
  }
  get remoteId() {
    return this.#controller.remoteId;
  }
  get localCreated() {
    return this.#controller.localCreated;
  }
  get service() {
    return this.#controller.service;
  }
  get readable() {
    return this.#controller.readable;
  }
  get writable() {
    return this.#controller.writable;
  }
  get closed() {
    return this.#controller.closed;
  }
  constructor(controller) {
    this.#controller = controller;
  }
  close() {
    return this.#controller.close();
  }
};

// node_modules/@yume-chan/adb/esm/daemon/dispatcher.js
var AdbPacketDispatcher = class {
  // ADB socket id starts from 1
  // (0 means open failed)
  #initializers = new AsyncOperationManager(1);
  /**
   * Socket local ID to the socket controller.
   */
  #sockets = /* @__PURE__ */ new Map();
  #writer;
  options;
  #closed = false;
  #disconnected = new PromiseResolver();
  get disconnected() {
    return this.#disconnected.promise;
  }
  #incomingSocketHandlers = /* @__PURE__ */ new Map();
  #readAbortController = new AbortController();
  constructor(connection, options) {
    this.options = options;
    if (this.options.initialDelayedAckBytes < 0) {
      this.options.initialDelayedAckBytes = 0;
    }
    connection.readable.pipeTo(new WritableStream({
      write: async (packet, controller) => {
        switch (packet.command) {
          case AdbCommand.Close:
            await this.#handleClose(packet);
            break;
          case AdbCommand.Okay:
            this.#handleOkay(packet);
            break;
          case AdbCommand.Open:
            await this.#handleOpen(packet);
            break;
          case AdbCommand.Write:
            this.#handleWrite(packet).catch((e) => {
              controller.error(e);
            });
            break;
          default:
            throw new Error(`Unknown command: ${packet.command.toString(16)}`);
        }
      }
    }), {
      preventCancel: options.preserveConnection ?? false,
      signal: this.#readAbortController.signal
    }).then(() => {
      this.#dispose();
    }, (e) => {
      if (!this.#closed) {
        this.#disconnected.reject(e);
      }
      this.#dispose();
    });
    this.#writer = connection.writable.getWriter();
  }
  async #handleClose(packet) {
    if (packet.arg0 === 0 && this.#initializers.reject(packet.arg1, new Error("Socket open failed"))) {
      return;
    }
    const socket = this.#sockets.get(packet.arg1);
    if (socket) {
      await socket.close();
      socket.dispose();
      this.#sockets.delete(packet.arg1);
      return;
    }
  }
  #handleOkay(packet) {
    let ackBytes;
    if (this.options.initialDelayedAckBytes !== 0) {
      if (packet.payload.length !== 4) {
        throw new Error("Invalid OKAY packet. Payload size should be 4");
      }
      ackBytes = getUint32LittleEndian(packet.payload, 0);
    } else {
      if (packet.payload.length !== 0) {
        throw new Error("Invalid OKAY packet. Payload size should be 0");
      }
      ackBytes = Infinity;
    }
    if (this.#initializers.resolve(packet.arg1, {
      remoteId: packet.arg0,
      availableWriteBytes: ackBytes
    })) {
      return;
    }
    const socket = this.#sockets.get(packet.arg1);
    if (socket) {
      socket.ack(ackBytes);
      return;
    }
    void this.sendPacket(AdbCommand.Close, packet.arg1, packet.arg0, EmptyUint8Array);
  }
  #sendOkay(localId, remoteId, ackBytes) {
    let payload;
    if (this.options.initialDelayedAckBytes !== 0) {
      payload = new Uint8Array(4);
      setUint32LittleEndian(payload, 0, ackBytes);
    } else {
      payload = EmptyUint8Array;
    }
    return this.sendPacket(AdbCommand.Okay, localId, remoteId, payload);
  }
  async #handleOpen(packet) {
    const [localId] = this.#initializers.add();
    this.#initializers.resolve(localId, void 0);
    const remoteId = packet.arg0;
    let availableWriteBytes = packet.arg1;
    let service = decodeUtf8(packet.payload);
    if (service.endsWith("\0")) {
      service = service.substring(0, service.length - 1);
    }
    if (this.options.initialDelayedAckBytes === 0) {
      if (availableWriteBytes !== 0) {
        throw new Error("Invalid OPEN packet. arg1 should be 0");
      }
      availableWriteBytes = Infinity;
    } else {
      if (availableWriteBytes === 0) {
        throw new Error("Invalid OPEN packet. arg1 should be greater than 0");
      }
    }
    const handler = this.#incomingSocketHandlers.get(service);
    if (!handler) {
      await this.sendPacket(AdbCommand.Close, 0, remoteId, EmptyUint8Array);
      return;
    }
    const controller = new AdbDaemonSocketController({
      dispatcher: this,
      localId,
      remoteId,
      localCreated: false,
      service,
      availableWriteBytes
    });
    try {
      await handler(controller.socket);
      this.#sockets.set(localId, controller);
      await this.#sendOkay(localId, remoteId, this.options.initialDelayedAckBytes);
    } catch {
      await this.sendPacket(AdbCommand.Close, 0, remoteId, EmptyUint8Array);
    }
  }
  async #handleWrite(packet) {
    const socket = this.#sockets.get(packet.arg1);
    if (!socket) {
      throw new Error(`Unknown local socket id: ${packet.arg1}`);
    }
    let handled = false;
    const promises = [
      (async () => {
        await socket.enqueue(packet.payload);
        await this.#sendOkay(packet.arg1, packet.arg0, packet.payload.length);
        handled = true;
      })()
    ];
    if (this.options.readTimeLimit) {
      promises.push((async () => {
        await delay(this.options.readTimeLimit);
        if (!handled) {
          throw new Error(`readable of \`${socket.service}\` has stalled for ${this.options.readTimeLimit} milliseconds`);
        }
      })());
    }
    await Promise.race(promises);
  }
  async createSocket(service) {
    if (this.options.appendNullToServiceString) {
      service += "\0";
    }
    const [localId, initializer] = this.#initializers.add();
    await this.sendPacket(AdbCommand.Open, localId, this.options.initialDelayedAckBytes, service);
    const { remoteId, availableWriteBytes } = await initializer;
    const controller = new AdbDaemonSocketController({
      dispatcher: this,
      localId,
      remoteId,
      localCreated: true,
      service,
      availableWriteBytes
    });
    this.#sockets.set(localId, controller);
    return controller.socket;
  }
  addReverseTunnel(service, handler) {
    this.#incomingSocketHandlers.set(service, handler);
  }
  removeReverseTunnel(address) {
    this.#incomingSocketHandlers.delete(address);
  }
  clearReverseTunnels() {
    this.#incomingSocketHandlers.clear();
  }
  async sendPacket(command, arg0, arg1, payload) {
    if (typeof payload === "string") {
      payload = encodeUtf8(payload);
    }
    if (payload.length > this.options.maxPayloadSize) {
      throw new TypeError("payload too large");
    }
    await Consumable.WritableStream.write(this.#writer, {
      command,
      arg0,
      arg1,
      payload,
      checksum: this.options.calculateChecksum ? calculateChecksum(payload) : 0,
      magic: command ^ 4294967295
    });
  }
  async close() {
    await Promise.all(Array.from(this.#sockets.values(), (socket) => socket.close()));
    this.#closed = true;
    this.#readAbortController.abort();
    if (this.options.preserveConnection) {
      this.#writer.releaseLock();
    } else {
      await this.#writer.close();
    }
  }
  #dispose() {
    for (const socket of this.#sockets.values()) {
      socket.dispose();
    }
    this.#disconnected.resolve();
  }
};

// node_modules/@yume-chan/adb/esm/daemon/transport.js
var ADB_DAEMON_VERSION_OMIT_CHECKSUM = 16777217;
var ADB_DAEMON_DEFAULT_FEATURES = /* @__PURE__ */ (() => [
  AdbFeature.ShellV2,
  AdbFeature.Cmd,
  AdbFeature.StatV2,
  AdbFeature.ListV2,
  AdbFeature.FixedPushMkdir,
  "apex",
  AdbFeature.Abb,
  // only tells the client the symlink timestamp issue in `adb push --sync` has been fixed.
  // No special handling required.
  "fixed_push_symlink_timestamp",
  AdbFeature.AbbExec,
  "remount_shell",
  "track_app",
  AdbFeature.SendReceiveV2,
  "sendrecv_v2_brotli",
  "sendrecv_v2_lz4",
  "sendrecv_v2_zstd",
  "sendrecv_v2_dry_run_send",
  AdbFeature.DelayedAck
])();
var ADB_DAEMON_DEFAULT_INITIAL_PAYLOAD_SIZE = 32 * 1024 * 1024;
var AdbDaemonTransport = class _AdbDaemonTransport {
  /**
   * Authenticate with the ADB Daemon and create a new transport.
   */
  static async authenticate({ serial, connection, credentialStore, authenticators = ADB_DEFAULT_AUTHENTICATORS, features = ADB_DAEMON_DEFAULT_FEATURES, initialDelayedAckBytes = ADB_DAEMON_DEFAULT_INITIAL_PAYLOAD_SIZE, ...options }) {
    let version = 16777217;
    let maxPayloadSize = 1024 * 1024;
    const resolver = new PromiseResolver();
    const authProcessor = new AdbAuthenticationProcessor(authenticators, credentialStore);
    const abortController = new AbortController();
    const pipe = connection.readable.pipeTo(new WritableStream({
      async write(packet) {
        switch (packet.command) {
          case AdbCommand.Connect:
            version = Math.min(version, packet.arg0);
            maxPayloadSize = Math.min(maxPayloadSize, packet.arg1);
            resolver.resolve(decodeUtf8(packet.payload));
            break;
          case AdbCommand.Auth: {
            const response = await authProcessor.process(packet);
            await sendPacket(response);
            break;
          }
          default:
            break;
        }
      }
    }), {
      // Don't cancel the source ReadableStream on AbortSignal abort.
      preventCancel: true,
      signal: abortController.signal
    }).then(() => {
      resolver.reject(new Error("Connection closed unexpectedly"));
    }, (e) => {
      resolver.reject(e);
    });
    const writer = connection.writable.getWriter();
    async function sendPacket(init) {
      init.checksum = calculateChecksum(init.payload);
      init.magic = init.command ^ 4294967295;
      await Consumable.WritableStream.write(writer, init);
    }
    const actualFeatures = features.slice();
    if (initialDelayedAckBytes <= 0) {
      const index = features.indexOf(AdbFeature.DelayedAck);
      if (index !== -1) {
        actualFeatures.splice(index, 1);
      }
    }
    let banner;
    try {
      await sendPacket({
        command: AdbCommand.Connect,
        arg0: version,
        arg1: maxPayloadSize,
        // The terminating `;` is required in formal definition
        // But ADB daemon (all versions) can still work without it
        payload: encodeUtf8(`host::features=${actualFeatures.join(",")}`)
      });
      banner = await resolver.promise;
    } finally {
      abortController.abort();
      writer.releaseLock();
      await pipe;
    }
    return new _AdbDaemonTransport({
      serial,
      connection,
      version,
      maxPayloadSize,
      banner,
      features: actualFeatures,
      initialDelayedAckBytes,
      ...options
    });
  }
  #connection;
  get connection() {
    return this.#connection;
  }
  #dispatcher;
  #serial;
  get serial() {
    return this.#serial;
  }
  #protocolVersion;
  get protocolVersion() {
    return this.#protocolVersion;
  }
  get maxPayloadSize() {
    return this.#dispatcher.options.maxPayloadSize;
  }
  #banner;
  get banner() {
    return this.#banner;
  }
  get disconnected() {
    return this.#dispatcher.disconnected;
  }
  #clientFeatures;
  get clientFeatures() {
    return this.#clientFeatures;
  }
  constructor({ serial, connection, version, banner, features = ADB_DAEMON_DEFAULT_FEATURES, initialDelayedAckBytes, ...options }) {
    this.#serial = serial;
    this.#connection = connection;
    this.#banner = AdbBanner.parse(banner);
    this.#clientFeatures = features;
    if (features.includes(AdbFeature.DelayedAck)) {
      if (initialDelayedAckBytes <= 0) {
        throw new TypeError("`initialDelayedAckBytes` must be greater than 0 when DelayedAck feature is enabled.");
      }
      if (!this.#banner.features.includes(AdbFeature.DelayedAck)) {
        initialDelayedAckBytes = 0;
      }
    } else {
      initialDelayedAckBytes = 0;
    }
    let calculateChecksum2;
    let appendNullToServiceString;
    if (version >= ADB_DAEMON_VERSION_OMIT_CHECKSUM) {
      calculateChecksum2 = false;
      appendNullToServiceString = false;
    } else {
      calculateChecksum2 = true;
      appendNullToServiceString = true;
    }
    this.#dispatcher = new AdbPacketDispatcher(connection, {
      calculateChecksum: calculateChecksum2,
      appendNullToServiceString,
      initialDelayedAckBytes,
      ...options
    });
    this.#protocolVersion = version;
  }
  connect(service) {
    return this.#dispatcher.createSocket(service);
  }
  addReverseTunnel(handler, address) {
    if (!address) {
      const id = Math.random().toString().substring(2);
      address = `localabstract:reverse_${id}`;
    }
    this.#dispatcher.addReverseTunnel(address, handler);
    return address;
  }
  removeReverseTunnel(address) {
    this.#dispatcher.removeReverseTunnel(address);
  }
  clearReverseTunnels() {
    this.#dispatcher.clearReverseTunnels();
  }
  close() {
    return this.#dispatcher.close();
  }
};

// test-auth.js
console.log(AdbDaemonTransport.authenticate);
