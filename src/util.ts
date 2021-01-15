/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

import { Dictionary } from './types';

export function assert(condition: any, message?: string) {
    if (!condition) {
        throw new Error(message);
    }
}

export function hasOwn(own: object, prop: string): boolean {
    return own.hasOwnProperty(prop);
}

export function isObject<T = unknown>(value: T): value is (object & T) {
    const type = typeof value;
    return type === 'function' || (!!value && type === 'object');
}

export function isArray(value: any): value is unknown[] {
    if (Array.isArray) {
        return Array.isArray(value);
    }
    return Object.prototype.toString.call(value) === '[object Array]';
}

export function isFunction(value: any): value is Function {
    return typeof value === 'function';
}

export function getMapValue<T>(map: Dictionary<T>, key: string): T {
    return (key != null && hasOwn(map, key)) ? map[key] : null;
}
