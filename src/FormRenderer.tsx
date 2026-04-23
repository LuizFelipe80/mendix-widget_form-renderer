import React, { ReactElement, createElement, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Input, InputNumber, Select, DatePicker, Divider, Typography, Tooltip, Modal, Tabs, Switch, Dropdown } from "antd";
import { EditOutlined, DeleteOutlined, TableOutlined, SettingOutlined } from "@ant-design/icons";
import { FormRendererContainerProps } from "../typings/FormRendererProps";
import { ObjectItem, ListAttributeValue } from "mendix";
import { Parser } from "hot-formula-parser";
import dayjs from "dayjs";

import "antd/dist/reset.css";
import "./ui/FormRenderer.css";

const { Title } = Typography;
const { TextArea } = Input;

declare global { interface Window { mx: any; } }

const getSizeMultiplier = (sizeEnum: string): number => {
    switch (sizeEnum) {
        case "Full": return 1;
        case "Two_Thirds": return 0.666;
        case "Half": return 0.5;
        case "One_Third": return 0.333;
        case "Quarter": return 0.25;
        case "One_Sixth": return 0.166;
        default: return 1;
    }
};

interface TableInputProps {
    item: ObjectItem;
    rows: number;
    cols: number;
    tableConfigAttr?: ListAttributeValue<string>;
    saveToMendix: (val: string) => void;
}

const TableInput = ({
    item, rows, cols, tableConfigAttr, saveToMendix, localValue, onChangeValue, showCoordinates
}: TableInputProps & { localValue: string, onChangeValue: (v: string) => void, showCoordinates: boolean }) => {

    const [rawConfig, setRawConfig] = useState(tableConfigAttr?.get(item).value || "");
    const [focusedCell, setFocusedCell] = useState<{r: number, c: number} | null>(null);

    const getColumnLabel = useCallback((colIndex: number) => {
        let dividend = colIndex + 1;
        let label = '';
        let modulo;
        while (dividend > 0) {
            modulo = (dividend - 1) % 26;
            label = String.fromCharCode(65 + modulo) + label;
            dividend = Math.floor((dividend - modulo) / 26);
        }
        return label;
    }, []);

    useEffect(() => {
        setRawConfig(tableConfigAttr?.get(item).value || "");
    }, [tableConfigAttr?.get(item).value]);

    const [data, setData] = useState<string[][]>([]);
    const isEditing = useRef(false);
    const dataRef = useRef(data);
    useEffect(() => { dataRef.current = data; }, [data]);

    const parser = useMemo(() => new Parser(), []);
    const evaluatingRef = useRef<Set<string>>(new Set());

    const evaluateCell = useCallback((r: number, c: number) => {
        const coord = `${r}-${c}`;
        if (evaluatingRef.current.has(coord)) return { error: '#REF!', result: null };

        evaluatingRef.current.add(coord);
        let rawVal = "";
        if (dataRef.current[r] && dataRef.current[r][c]) {
            rawVal = dataRef.current[r][c];
        }

        let res;
        if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
            res = parser.parse(rawVal.substring(1));
        } else {
            const asNum = Number(rawVal);
            res = { error: null, result: rawVal === "" ? "" : (isNaN(asNum) ? rawVal : asNum) };
        }

        evaluatingRef.current.delete(coord);
        return res;
    }, [parser]);

    useEffect(() => {
        parser.on('callCellValue', (cellCoord: any, done: any) => {
            const r = cellCoord.row.index;
            const c = cellCoord.column.index;
            const res = evaluateCell(r, c);
            done(res.error ? res.error : res.result);
        });

        parser.on('callRangeValue', (startCellCoord: any, endCellCoord: any, done: any) => {
            const fragment = [];
            for (let r = startCellCoord.row.index; r <= endCellCoord.row.index; r++) {
                const rowData = [];
                for (let c = startCellCoord.column.index; c <= endCellCoord.column.index; c++) {
                    const res = evaluateCell(r, c);
                    rowData.push(res.error ? res.error : res.result);
                }
                fragment.push(rowData);
            }
            done(fragment);
        });
    }, [parser, evaluateCell]);

    const headerKeys = useMemo(() => {
        if (!rawConfig) return [];
        return rawConfig.replace(/[\[\]"]/g, "").split(",").map(s => s.trim());
    }, [rawConfig]);

    useEffect(() => {
        if (isEditing.current) return;
        try {
            const parsed = JSON.parse(localValue);
            if (parsed && parsed.cells && Array.isArray(parsed.cells)) {
                const newData = Array.from({ length: rows }, () => Array(cols).fill(""));
                parsed.cells.forEach((cell: any) => {
                    if (cell.row < rows && cell.col < cols) {
                        newData[cell.row][cell.col] = cell.value;
                    }
                });
                setData(newData);
            } else if (Array.isArray(parsed) && parsed.length > 0) {
                setData(parsed);
            } else if (data.length === 0) {
                setData(Array.from({ length: rows }, () => Array(cols).fill("")));
            }
        } catch (e) {
            if (data.length === 0) setData(Array.from({ length: rows }, () => Array(cols).fill("")));
        }
    }, [localValue, rows, cols]);

    const handleCellChange = (r: number, c: number, value: string) => {
        isEditing.current = true;
        const newData = [...data];
        newData[r] = [...newData[r]];
        newData[r][c] = value;
        setData(newData);
    };

    const handleFinalize = () => {
        isEditing.current = false;
        const cells = [];
        for (let r = 0; r < data.length; r++) {
            for (let c = 0; c < data[r].length; c++) {
                cells.push({ row: r, col: c, value: data[r][c] });
            }
        }
        const stringified = JSON.stringify({ cells });
        onChangeValue(stringified);
        saveToMendix(stringified);
    };

    if (data.length === 0) return null;

    return (
        <div className="dynamic-table-wrapper">
            <table className="form-custom-table">
                {showCoordinates && (
                    <thead>
                        <tr>
                            <th className="excel-coord-corner"></th>
                            {Array.from({ length: cols }).map((_, c) => (
                                <th key={`col-${c}`} className="excel-coord-header">{getColumnLabel(c)}</th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {data.map((_, r) => (
                        <tr key={`row-${r}`}>
                            {showCoordinates && <th className="excel-coord-row">{r + 1}</th>}
                            {Array.from({ length: cols }).map((_, c) => {
                                const isHeader = headerKeys.includes(`${r}-${c}`);
                                const isFocused = focusedCell?.r === r && focusedCell?.c === c;
                                const rawVal = data[r] && data[r][c] !== undefined ? data[r][c] : "";
                                let displayValue = rawVal;
                                let hasError = false;
                                let errorMsg = "";

                                if (!isFocused && typeof rawVal === 'string' && rawVal.startsWith('=')) {
                                    const res = evaluateCell(r, c);
                                    if (res.error) {
                                        hasError = true;
                                        errorMsg = res.error;
                                        displayValue = "-";
                                    } else {
                                        displayValue = res.result !== null && res.result !== undefined ? String(res.result) : "";
                                    }
                                }

                                const cellInput = (
                                    <Input
                                        value={displayValue}
                                        onChange={e => handleCellChange(r, c, e.target.value)}
                                        onFocus={() => setFocusedCell({r, c})}
                                        onBlur={() => { setFocusedCell(null); handleFinalize(); }}
                                        disabled={isHeader}
                                        className={isHeader ? "table-header-cell" : "table-plain-input"}
                                    />
                                );

                                return (
                                    <td key={`${r}-${c}`} className={isHeader ? "cell-header" : "cell-editable"}>
                                        {hasError ? <Tooltip title={errorMsg} placement="topLeft" color="red">{cellInput}</Tooltip> : cellInput}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface FieldInputProps {
    item: ObjectItem;
    fieldType: string;
    fieldValueAttr: ListAttributeValue<string>;
    fieldLabelAttr: ListAttributeValue<string>;
    tableRowsAttr?: ListAttributeValue<any>;
    tableColsAttr?: ListAttributeValue<any>;
    tableConfigAttr?: ListAttributeValue<string>;
    onChangeAction?: any;
    inputCache: React.MutableRefObject<Map<string, string>>;
    editMode: boolean;
    onCacheUpdated: () => void;
    showCoordinates: boolean;
}

const FieldInput = ({ item, fieldType, fieldValueAttr, fieldLabelAttr, tableRowsAttr, tableColsAttr, tableConfigAttr, onChangeAction, inputCache, editMode, onCacheUpdated, showCoordinates }: FieldInputProps) => {
    const fieldKey = fieldLabelAttr.get(item).value || item.id;
    const initialValue = fieldValueAttr.get(item).value || "";

    const [localValue, setLocalValue] = useState(() => {
        if (inputCache.current.has(fieldKey)) {
            return inputCache.current.get(fieldKey)!;
        }
        return initialValue;
    });

    useEffect(() => {
        const cached = inputCache.current.get(fieldKey);

        if (initialValue !== cached) {
            if (initialValue !== "") {
                setLocalValue(initialValue);
                inputCache.current.set(fieldKey, initialValue);
            } else if (initialValue === "" && cached !== undefined && cached !== "") {
                setLocalValue(cached);
                const prop = fieldValueAttr.get(item);
                if (prop && !prop.readOnly) {
                    prop.setValue(cached);
                }
            } else {
                setLocalValue(initialValue);
            }
        }
    }, [initialValue, fieldKey, inputCache, item.id, fieldValueAttr.id]);

    const handleChange = (newVal: string) => {
        setLocalValue(newVal);
        inputCache.current.set(fieldKey, newVal);
    };

    const saveToMendix = (newValue: string) => {
        const prop = fieldValueAttr.get(item);
        if (prop && !prop.readOnly) {
            prop.setValue(newValue);
            if (onChangeAction) {
                const action = onChangeAction.get(item);
                if (action && action.canExecute) action.execute();
            }
        }
        onCacheUpdated();
    };

    const withTooltip = (node: ReactElement) => (<Tooltip title={localValue} placement="topLeft" mouseEnterDelay={0.5}>{node}</Tooltip>);
    const type = fieldType ? fieldType.trim().toLowerCase() : "";
    const isTable = type === "table";
    const disabledState = editMode && !isTable;

    if (isTable) {
        const r = Number(tableRowsAttr?.get(item).value?.toString()) || 1;
        const c = Number(tableColsAttr?.get(item).value?.toString()) || 1;
        return <TableInput item={item} rows={r} cols={c} tableConfigAttr={tableConfigAttr} saveToMendix={saveToMendix} localValue={localValue} onChangeValue={handleChange} showCoordinates={showCoordinates} />;
    }

    if (type === "integer") return withTooltip(<InputNumber disabled={disabledState} style={{ width: "100%" }} value={localValue ? parseInt(localValue, 10) : undefined} onChange={val => { const str = val !== null ? String(val) : ""; handleChange(str); }} onBlur={() => saveToMendix(localValue)} />);
    if (type === "decimal") return withTooltip(<InputNumber disabled={disabledState} style={{ width: "100%" }} value={localValue ? parseFloat(localValue) : undefined} step="0.01" stringMode onChange={val => { const str = val !== null ? String(val) : ""; handleChange(str); }} onBlur={() => saveToMendix(localValue)} />);
    if (type === "_boolean" || type === "boolean") return <Select disabled={disabledState} style={{ width: "100%" }} value={localValue === "true" ? "true" : localValue === "false" ? "false" : undefined} placeholder="Selecione..." onChange={val => { handleChange(val); saveToMendix(val); }} options={[{ value: "true", label: "Sim" }, { value: "false", label: "Não" }]} />;
    if (type === "datetime" || type === "date") return withTooltip(<DatePicker disabled={disabledState} style={{ width: "100%" }} value={localValue ? dayjs(localValue) : null} format="DD/MM/YYYY" onChange={date => { const str = date ? date.toISOString() : ""; handleChange(str); saveToMendix(str); }} />);
    if (type === "textarea") return withTooltip(<TextArea disabled={disabledState} rows={4} value={localValue} onChange={e => handleChange(e.target.value)} onBlur={() => saveToMendix(localValue)} />);

    return withTooltip(<Input disabled={disabledState} value={localValue} onChange={e => handleChange(e.target.value)} onBlur={() => saveToMendix(localValue)} />);
};

export function FormRenderer({ fieldsDS, fieldLabel, fieldValue, fieldType, fieldSession, linePos, colPos, fieldSize, tableRows, tableCols, tableConfig, outputJSON, editMode, onEditAction, onDeleteAction, onChangeAction }: FormRendererContainerProps): ReactElement {

    const inputCacheRef = useRef<Map<string, string>>(new Map());
    const [showCoordinates, setShowCoordinates] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const dropdownItems = [
        {
            key: '1',
            label: (
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 220 }}>
                    <span style={{ fontSize: '13px' }}>Show Coordinates (A1)</span>
                    <Switch size="small" checked={showCoordinates} onChange={setShowCoordinates} />
                </div>
            )
        },
        {
            type: 'divider' as const
        },
        {
            key: '2',
            label: <span style={{ fontSize: '13px' }}>📖 Formula Instructions</span>,
            onClick: () => setIsSettingsOpen(true)
        }
    ];

    const exportFormState = () => {
        if (!outputJSON || outputJSON.readOnly) return;
        if (!fieldsDS.items) return;

        const formState = fieldsDS.items.map(item => {
            const key = fieldLabel.get(item).value || item.id;
            const cached = inputCacheRef.current.get(key);
            const val = cached !== undefined ? cached : (fieldValue.get(item).value || "");
            return {
                fieldId: item.id,
                label: key,
                value: val
            };
        });

        outputJSON.setValue(JSON.stringify(formState));
    };

    const formStructure = useMemo(() => {
        const structure = new Map<string, Map<number, ObjectItem[]>>();
        if (fieldsDS.status !== "available" || !fieldsDS.items) return structure;
        fieldsDS.items.forEach(item => {
            const sName = fieldSession.get(item).value || "Geral";
            const lp = Number(linePos.get(item).value) || 1;
            if (!structure.has(sName)) structure.set(sName, new Map());
            const sessionRows = structure.get(sName)!;
            if (!sessionRows.has(lp)) sessionRows.set(lp, []);
            sessionRows.get(lp)!.push(item);
        });
        structure.forEach(sessionRows => {
            sessionRows.forEach(fields => {
                fields.sort((a, b) => (Number(colPos.get(a).value) || 0) - (Number(colPos.get(b).value) || 0));
            });
        });
        return structure;
    }, [fieldsDS, fieldSession, linePos, colPos]);

    return (
        <div className="form-renderer-container">
            {Array.from(formStructure.entries()).map(([sessionName, rowsMap]) => {
                const hasTable = Array.from(rowsMap.values()).flat().some(item => (fieldType.get(item).value || "").trim().toLowerCase() === "table");
                return (
                <div key={sessionName} className="form-session-wrapper">
                    <Divider orientation={"left" as any}>
                        <Title level={5} className="session-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            {sessionName}
                            {hasTable && (
                                <Dropdown menu={{ items: dropdownItems }} trigger={['click']} placement="bottomLeft">
                                    <Tooltip title="Table Settings & Formulas">
                                        <SettingOutlined style={{ fontSize: '14px', color: '#888', cursor: 'pointer', verticalAlign: 'middle' }} />
                                    </Tooltip>
                                </Dropdown>
                            )}
                        </Title>
                    </Divider>
                    <div className="form-rows-container">
                        {Array.from(rowsMap.entries()).sort(([a], [b]) => a - b).map(([lp, fields]) => {
                            const maxCPInRow = Math.min(3, Math.max(...fields.map(f => Number(colPos.get(f).value) || 1)));
                            const baseSlotWidth = 100 / maxCPInRow;

                            return (
                                <div key={lp} className="form-row-flex">
                                    {Array.from({ length: maxCPInRow }).map((_, idx) => {
                                        const currentCP = idx + 1;
                                        const field = fields.find(f => Number(colPos.get(f).value) === currentCP);
                                        if (field) {
                                            const multiplier = getSizeMultiplier(fieldSize.get(field).value || "Full");
                                            const finalWidth = baseSlotWidth * multiplier;
                                            const typeValue = fieldType.get(field).value || "String";
                                            return (
                                                <div key={field.id} className="field-item" style={{ width: `${finalWidth}%` }}>
                                                    <div className="field-label-row">
                                                        <label className="field-label">{fieldLabel.get(field).value}</label>
                                                        {editMode && onEditAction && (
                                                            <Tooltip title="Editar Campo">
                                                                <EditOutlined className="edit-icon-btn" onClick={() => onEditAction.get(field).execute()} />
                                                            </Tooltip>
                                                        )}
                                                        {editMode && onDeleteAction && (
                                                            <Tooltip title="Excluir Campo">
                                                                <DeleteOutlined className="edit-icon-btn action-delete-btn" onClick={() => onDeleteAction.get(field).execute()} />
                                                            </Tooltip>
                                                        )}
                                                        {editMode && typeValue.trim().toLowerCase() === "table" && tableConfig && (
                                                            <Tooltip title="Extrair Headers Preenchidos">
                                                                <TableOutlined className="edit-icon-btn action-header-btn" onMouseDown={() => {
                                                                    setTimeout(() => {
                                                                        const key = fieldLabel.get(field).value || field.id;
                                                                        let val = inputCacheRef.current.get(key) || fieldValue.get(field).value || "";
                                                                        if (!val || val.trim() === "") val = "{\"cells\":[]}";

                                                                        try {
                                                                            const parsed = JSON.parse(val);
                                                                            const configs: string[] = [];

                                                                            if (parsed && parsed.cells && Array.isArray(parsed.cells)) {
                                                                                parsed.cells.forEach((cell: any) => {
                                                                                    if (cell.value && cell.value.trim() !== "") {
                                                                                        configs.push(`${cell.row}-${cell.col}`);
                                                                                    }
                                                                                });
                                                                            } else if (Array.isArray(parsed)) {
                                                                                for (let ro = 0; ro < parsed.length; ro++) {
                                                                                    if (parsed[ro] && Array.isArray(parsed[ro])) {
                                                                                        for (let co = 0; co < parsed[ro].length; co++) {
                                                                                            if (parsed[ro][co] && parsed[ro][co].trim() !== "") {
                                                                                                configs.push(`${ro}-${co}`);
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }

                                                                            const stringified = configs.join(", ");

                                                                            const propConfig = tableConfig.get(field);
                                                                            if (propConfig && !propConfig.readOnly) {
                                                                                propConfig.setValue(stringified);
                                                                            }
                                                                            exportFormState();
                                                                        } catch (e) { console.error("JSON Error parsing table data", e); }
                                                                    }, 150);
                                                                }} />
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                    <FieldInput
                                                        item={field}
                                                        fieldType={typeValue}
                                                        fieldValueAttr={fieldValue}
                                                        fieldLabelAttr={fieldLabel}
                                                        tableRowsAttr={tableRows}
                                                        tableColsAttr={tableCols}
                                                        tableConfigAttr={tableConfig}
                                                        onChangeAction={onChangeAction}
                                                        inputCache={inputCacheRef}
                                                        editMode={editMode}
                                                        onCacheUpdated={exportFormState}
                                                        showCoordinates={showCoordinates}
                                                    />
                                                </div>
                                            );
                                        } else {
                                            return <div key={`spacer-${currentCP}`} className="field-spacer" style={{ width: `${baseSlotWidth}%` }} />;
                                        }
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )})}

            <Modal
                title="📖 Formula Instructions"
                open={isSettingsOpen}
                onCancel={() => setIsSettingsOpen(false)}
                footer={null}
                width={600}
            >
                <Tabs defaultActiveKey="1" items={[
                    {
                        key: "1",
                        label: "Math & Statistics",
                        children: (
                            <div style={{ padding: "8px 0" }}>
                                <p>You can use table cells like a smart spreadsheet. Always start with the equal sign <code>=</code>.</p>
                                <ul style={{ lineHeight: '2' }}>
                                    <li><code>=SUM(A1:B2)</code>: Sums all values in the range from A1 to B2.</li>
                                    <li><code>=AVERAGE(A1:A5)</code>: Calculates the average of the values in the range.</li>
                                    <li><code>=MAX(A1:B1)</code>: Returns the maximum value found.</li>
                                    <li><code>=A1 * 5 / B2</code>: Performs direct calculations using basic operators.</li>
                                </ul>
                                <p style={{ color: '#888', fontStyle: 'italic', marginTop: 12 }}>
                                    Tip: Formulas use the English standard syntax natively.
                                </p>
                            </div>
                        )
                    },
                    {
                        key: "2",
                        label: "Logic & Text",
                        children: (
                            <div style={{ padding: "8px 0" }}>
                                <ul style={{ lineHeight: '2' }}>
                                    <li><code>=IF(A1&gt;10, "Approved", "Rejected")</code>: Conditional logic.</li>
                                    <li><code>=CONCATENATE(A1, " ", B1)</code>: Joins two or more strings into a single cell.</li>
                                    <li><code>=EXACT(A1, B1)</code>: Checks if two strings are exactly the same (returns TRUE or FALSE).</li>
                                </ul>
                                <p style={{ color: '#888', fontStyle: 'italic', marginTop: 12 }}>
                                    Note: Function parameters are always separated by commas (<code>,</code>).
                                </p>
                            </div>
                        )
                    }
                ]} />
            </Modal>
        </div>
    );
}