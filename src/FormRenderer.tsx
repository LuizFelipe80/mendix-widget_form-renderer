import { ReactElement, createElement, useMemo, useState, useEffect, useRef } from "react";
import { Input, InputNumber, Select, DatePicker, Divider, Typography, Tooltip } from "antd";
import { EditOutlined, DeleteOutlined, TableOutlined } from "@ant-design/icons";
import { FormRendererContainerProps } from "../typings/FormRendererProps";
import { ObjectItem, ListAttributeValue } from "mendix";
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

/**
 * COMPONENTE DE TABELA DINÂMICA COM PROTEÇÃO DE DADOS
 */
interface TableInputProps {
    item: ObjectItem;
    rows: number;
    cols: number;
    tableConfigAttr?: ListAttributeValue<string>;
    saveToMendix: (val: string) => void;
}

const TableInput = ({ 
    item, rows, cols, tableConfigAttr, saveToMendix, localValue, onChangeValue 
}: TableInputProps & { localValue: string, onChangeValue: (v: string) => void }) => {
    
    const [rawConfig, setRawConfig] = useState(tableConfigAttr?.get(item).value || "");

    useEffect(() => {
        setRawConfig(tableConfigAttr?.get(item).value || "");
    }, [tableConfigAttr?.get(item).value]);

    useEffect(() => {
        if (!window.mx || !window.mx.data || !tableConfigAttr?.id) return;
        const sub = window.mx.data.subscribe({
            guid: item.id,
            attr: tableConfigAttr.id,
            callback: (_guid: string, _attr: string, value: string) => {
                setRawConfig(value || "");
            }
        });
        return () => {
            if (sub && window.mx.data.unsubscribe) window.mx.data.unsubscribe(sub);
        };
    }, [item.id, tableConfigAttr?.id]);
    
    const [data, setData] = useState<string[][]>([]);
    const isEditing = useRef(false);

    const headerKeys = useMemo(() => {
        if (!rawConfig) return [];
        return rawConfig.replace(/[\[\]"]/g, "").split(",").map(s => s.trim());
    }, [rawConfig]);

    useEffect(() => {
        if (isEditing.current) return;
        
        try {
            const parsed = JSON.parse(localValue);
            if (Array.isArray(parsed) && parsed.length > 0) {
                setData(parsed);
                return;
            }
        } catch (e) {}

        if (data.length === 0) {
            setData(Array.from({ length: rows }, () => Array(cols).fill("")));
        }
    }, [localValue, rows, cols]);

    const updateCell = (r: number, c: number, value: string) => {
        isEditing.current = true;
        const newData = [...data];
        newData[r] = [...newData[r]];
        newData[r][c] = value;
        setData(newData);
    };

    const handleFinalize = () => {
        isEditing.current = false;
        const stringified = JSON.stringify(data);
        onChangeValue(stringified);
        saveToMendix(stringified);
    };

    if (data.length === 0) return null;

    return (
        <div className="dynamic-table-wrapper">
            <table className="form-custom-table">
                <tbody>
                    {data.map((row, r) => (
                        <tr key={`row-${r}`}>
                            {Array.from({ length: cols }).map((_, c) => {
                                const isHeader = headerKeys.includes(`${r}-${c}`);
                                const cellValue = row[c] || "";
                                return (
                                    <td key={`cell-${r}-${c}`} className={isHeader ? "cell-header" : "cell-editable"}>
                                        {isHeader ? (
                                            <div className="table-header-content">{cellValue}</div>
                                        ) : (
                                            <input 
                                                className="table-plain-input"
                                                value={cellValue}
                                                onChange={e => updateCell(r, c, e.target.value)}
                                                onBlur={handleFinalize}
                                            />
                                        )}
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
}

const FieldInput = ({ item, fieldType, fieldValueAttr, fieldLabelAttr, tableRowsAttr, tableColsAttr, tableConfigAttr, onChangeAction, inputCache, editMode }: FieldInputProps) => {
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
                if (window.mx && window.mx.data) {
                    window.mx.data.get({
                        guid: item.id,
                        callback: (mxobj: any) => {
                            if (mxobj) mxobj.set(fieldValueAttr.id, cached);
                        }
                    });
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
        if (window.mx && window.mx.data) {
            window.mx.data.get({
                guid: item.id,
                callback: (mxobj: any) => {
                    if (mxobj) {
                        mxobj.set(fieldValueAttr.id, newValue);
                        if (mxobj.update) mxobj.update();
                        if (onChangeAction) {
                            const action = onChangeAction.get(item);
                            if (action && action.canExecute) action.execute();
                        }
                    }
                }
            });
        }
    };

    const withTooltip = (node: ReactElement) => (<Tooltip title={localValue} placement="topLeft" mouseEnterDelay={0.5}>{node}</Tooltip>);
    const type = fieldType ? fieldType.trim().toLowerCase() : "";
    const isTable = type === "table";
    const disabledState = editMode && !isTable;

    if (isTable) {
        const r = Number(tableRowsAttr?.get(item).value?.toString()) || 1;
        const c = Number(tableColsAttr?.get(item).value?.toString()) || 1;
        return <TableInput item={item} rows={r} cols={c} tableConfigAttr={tableConfigAttr} saveToMendix={saveToMendix} localValue={localValue} onChangeValue={handleChange} />;
    }

    if (type === "integer") return withTooltip(<InputNumber disabled={disabledState} style={{ width: "100%" }} value={localValue ? parseInt(localValue, 10) : undefined} onChange={val => { const str = val !== null ? String(val) : ""; handleChange(str); }} onBlur={() => saveToMendix(localValue)} />);
    if (type === "decimal") return withTooltip(<InputNumber disabled={disabledState} style={{ width: "100%" }} value={localValue ? parseFloat(localValue) : undefined} step="0.01" stringMode onChange={val => { const str = val !== null ? String(val) : ""; handleChange(str); }} onBlur={() => saveToMendix(localValue)} />);
    if (type === "_boolean" || type === "boolean") return <Select disabled={disabledState} style={{ width: "100%" }} value={localValue === "true" ? "true" : localValue === "false" ? "false" : undefined} placeholder="Selecione..." onChange={val => { handleChange(val); saveToMendix(val); }} options={[{ value: "true", label: "True" }, { value: "false", label: "False" }]} />;
    if (type === "date") return withTooltip(<DatePicker disabled={disabledState} style={{ width: "100%" }} value={localValue ? dayjs(localValue) : null} format="DD/MM/YYYY" onChange={date => { const isoDate = date ? date.toISOString() : ""; handleChange(isoDate); saveToMendix(isoDate); }} />);
    if (type === "textarea") return withTooltip(<TextArea disabled={disabledState} rows={4} value={localValue} onChange={e => handleChange(e.target.value)} onBlur={() => saveToMendix(localValue)} />);

    return withTooltip(<Input disabled={disabledState} value={localValue} onChange={e => handleChange(e.target.value)} onBlur={() => saveToMendix(localValue)} />);
};

export function FormRenderer({ fieldsDS, fieldLabel, fieldValue, fieldType, fieldSession, linePos, colPos, fieldSize, tableRows, tableCols, tableConfig, editMode, onEditAction, onDeleteAction, onChangeAction }: FormRendererContainerProps): ReactElement {
    
    // CACHE ROOT TO SURVIVE RE-RENDERS
    const inputCacheRef = useRef<Map<string, string>>(new Map());

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
            {Array.from(formStructure.entries()).map(([sessionName, rowsMap]) => (
                <div key={sessionName} className="form-session-wrapper">
                    <Divider orientation={"left" as any}><Title level={5} className="session-title">{sessionName}</Title></Divider>
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
                                                                <TableOutlined className="edit-icon-btn action-header-btn" onClick={() => {
                                                                    const key = fieldLabel.get(field).value || field.id;
                                                                    let val = inputCacheRef.current.get(key) || fieldValue.get(field).value || "";
                                                                    if (!val || val.trim() === "") val = "[]";
                                                                    
                                                                    try {
                                                                        const parsed = JSON.parse(val);
                                                                        const configs: string[] = [];
                                                                        for(let ro = 0; ro < parsed.length; ro++) {
                                                                            if (parsed[ro] && Array.isArray(parsed[ro])) {
                                                                                for (let co = 0; co < parsed[ro].length; co++) {
                                                                                    if (parsed[ro][co] && parsed[ro][co].trim() !== "") {
                                                                                        configs.push(`${ro}-${co}`);
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                        const stringified = JSON.stringify(configs);
                                                                        
                                                                        if (window.mx && window.mx.data) {
                                                                            window.mx.data.get({
                                                                                guid: field.id,
                                                                                callback: (mxobj: any) => {
                                                                                    if (mxobj) {
                                                                                        mxobj.set(tableConfig.id, stringified);
                                                                                        if (window.mx.data.commit) {
                                                                                            window.mx.data.commit({
                                                                                                mxobj,
                                                                                                callback: () => {
                                                                                                    if (mxobj.update) mxobj.update();
                                                                                                }
                                                                                            });
                                                                                        } else {
                                                                                            if (mxobj.update) mxobj.update();
                                                                                        }
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    } catch(e) { console.error("JSON Error parsing table data", e); }
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
            ))}
        </div>
    );
}