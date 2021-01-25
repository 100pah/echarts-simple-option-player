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

import { assert, getMapValue, hasOwn, isArray, isFunction, isObject } from './util';
import { EChartsOption, EChartsType } from 'echarts';
import { DimensionName } from './types';

/**
 * @usage
 * ```js
 * // Initialize with an array of echarts option info:
 * const player = ecSimpleOptionPlayer.create({
 *
 *     // The echarts instance or chart instance getter.
 *     chart: function () {
 *         return myChart;
 *     },
 *     seriesIndex: 0,
 *     replaceMerge: ['xAxis', 'yAxis']
 *
 *     // The data meta info used to determine how to
 *     // make transition mapping.
 *     // The strategy: If `uniqueDimension` provided and is a common
 *     // dimension, use `uniqueDimension`.
 *     dataMeta: {
 *         aaa: {
 *             dimensions: ['qqq', 'www', 'eee', 'rrr']
 *         },
 *         bbb: {
 *             dimensions: ['ccc', 'www', 'eee'],
 *             uniqueDimension: 'www',
 *             dividingMethod: 'duplicate'
 *         },
 *         ...
 *     },
 *
 *     // echarts option collection:
 *     optionList: [
 *         // dataMetaKey is the key of 'dataMeta'.
 *         { key: 'Time_Income_Bar', option: option0, dataMetaKey: 'aaa' },
 *         { key: 'Population_Income_Scatter', option: option1, dataMetaKey: 'bbb' },
 *         { key: 'Time_Income_Pie', option: option2, dataMetaKey: 'aaa' },
 *         ...
 *     ]
 * });
 *
 * // Then start to play:
 * player.next(); // Display next option (from the first option).
 * player.previous(); // Display previous optoin.
 * player.go('Time_Income_Pie'); // Display the specified option.
 * player.getOptionKeys(); // return `['Time_Income_Bar', 'Population_Income_Scatter', 'Time_Income_Pie']`
 * ```
 */
export function create(opt: SimpleOptionPlayerOpt) {
    return new SimpleOptionPlayer(opt);
}

type SimpleOptionPlayerOpt = {
    chart: SimpleOptionPlayer['_chart'];
    // Target series index to be transitioned.
    seriesIndex: number;
    replaceMerge?: SimpleOptionPlayer['_replaceMerge'];
    optionList: SimpleOptionPlayer['_optionList'];
    dataMeta: SimpleOptionPlayer['_dataMeta'];
};

class SimpleOptionPlayer {

    private _chart: EChartsType | (() => EChartsType);
    private _dataMeta: {
        // An user defined key for a dataMeta.
        [dataMetaKey in string]: {
            dimensions: DimensionName[];
            uniqueDimension?: string;
            dividingMethod?: 'split' | 'duplicate'
        }
    };
    private _optionList: {
        // An user defined key for an option.
        key: string;
        option: EChartsOption;
        dataMetaKey: string;
    }[];
    private _replaceMerge: (keyof EChartsOption & string)[];

    private _seriesIndex: number;

    private _currOptionIdx: number;

    // value: option index in SimpleOptionPlayer['_optionList'].
    private _optionMap: { [optionKey: string]: number };


    constructor(opt: SimpleOptionPlayerOpt) {
        assert(
            opt.chart
            && isObject(opt.dataMeta)
            && isArray(opt.optionList)
            && opt.optionList.length
        );

        this._chart = opt.chart;
        this._dataMeta = opt.dataMeta;
        const optionList = this._optionList = opt.optionList;
        const optionMap = this._optionMap = {} as SimpleOptionPlayer['_optionMap'];
        this._replaceMerge = opt.replaceMerge;
        this._seriesIndex = opt.seriesIndex || 0;
        this._currOptionIdx = null;

        for (let i = 0; i < optionList.length; i++) {
            const optionWrap = optionList[i];
            const optionKey = optionWrap.key;
            if (optionKey != null) {
                assert(!hasOwn(optionMap, optionKey), 'option key duplicat: ' + optionKey);
                optionMap[optionKey] = i;
            }
        }
    }

    next(): void {
        const optionList = this._optionList;
        const newOptionIdx = this._currOptionIdx == null
            ? 0
            : Math.min(optionList.length - 1, this._currOptionIdx + 1);

        this._doChangeOption(newOptionIdx);
    };

    previous(): void {
        const optionList = this._optionList;
        const newOptionIdx = this._currOptionIdx == null
            ? optionList.length - 1
            : Math.max(0, this._currOptionIdx - 1);

        this._doChangeOption(newOptionIdx);
    }

    go(optionKey: string): void {
        const newOptionIdx = getMapValue(this._optionMap, optionKey);
        assert(newOptionIdx != null, 'Can not find option by option key: ' + optionKey);

        this._doChangeOption(newOptionIdx);
    }

    private _doChangeOption(newOptionIdx: number): void {
        const optionList = this._optionList;
        const oldOptionWrap = this._currOptionIdx != null ? optionList[this._currOptionIdx] : null;
        const newOptionWrap = optionList[newOptionIdx];
        const dataMeta = this._dataMeta;
        const targetSeriesIndex = this._seriesIndex;

        let transitionOpt = {
            // If can not find mapped dimensions, do not make transition animation
            // by default, becuase this transition probably bring about misleading.
            to: { seriesIndex: targetSeriesIndex }
        } as Parameters<EChartsType['setOption']>[1]['transition'];

        if (oldOptionWrap) {
            const common =
                findCommonDimension(oldOptionWrap, newOptionWrap)
                || findCommonDimension(newOptionWrap, oldOptionWrap);
            if (common != null) {
                transitionOpt = {
                    from: {
                        seriesIndex: targetSeriesIndex,
                        dimension: common.uniqueDimension
                    },
                    to: {
                        seriesIndex: targetSeriesIndex,
                        dimension: common.uniqueDimension
                    },
                    dividingMethod: common.dividingMethod
                };
            }
        }

        this._currOptionIdx = newOptionIdx;

        this._getChart().setOption(newOptionWrap.option, {
            replaceMerge: this._replaceMerge,
            transition: transitionOpt
        });

        function findCommonDimension(
            optionWrapA: typeof optionList[number],
            optionWrapB: typeof optionList[number]
        ) {
            const metaA = getMapValue(dataMeta, optionWrapA.dataMetaKey);
            const metaB = getMapValue(dataMeta, optionWrapB.dataMetaKey);
            const uniqueDimensionB = metaB.uniqueDimension;
            if (uniqueDimensionB != null && metaA.dimensions.indexOf(uniqueDimensionB) >= 0) {
                return {
                    uniqueDimension: uniqueDimensionB,
                    dividingMethod: metaB.dividingMethod
                };
            }
        }

    }

    private _getChart(): EChartsType {
        return isFunction(this._chart) ? this._chart() : this._chart;
    }

    getOptionKeys(): string[] {
        const optionKeys = [];
        const optionList = this._optionList;
        for (let i = 0; i < optionList.length; i++) {
            optionKeys.push(optionList[i].key);
        }
        return optionKeys;
    }

}
