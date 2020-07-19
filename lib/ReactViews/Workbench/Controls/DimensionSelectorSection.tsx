"use strict";

import React from "react";
import { observer } from "mobx-react";
import CommonStrata from "../../../Models/CommonStrata";
import { runInAction, action } from "mobx";
import SelectableDimensions, {
  SelectableDimension
} from "../../../Models/SelectableDimensions";

import Select from "../../../Styled/Select";
import isDefined from "../../../Core/isDefined";
const Text: any = require("../../../Styled/Text").default;
const Box: any = require("../../../Styled/Box").default;
const Spacing: any = require("../../../Styled/Spacing").default;

@observer
export default class DimensionSelectorSection extends React.Component<{
  item: SelectableDimensions;
}> {
  @action
  setDimensionValue(
    dimension: SelectableDimension,
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    dimension.setDimensionValue(CommonStrata.user, event.target.value);
  }

  render() {
    const item = this.props.item;

    // Filter out dimensions with only 1 option (unless they have 1 option and allow undefined - which is 2 total options)
    const selectableDimensions = item.selectableDimensions?.filter(
      dim =>
        !dim.disable && dim.options.length + (dim.allowUndefined ? 1 : 0) > 1
    );

    if (
      !SelectableDimensions.is(item) ||
      !isDefined(selectableDimensions) ||
      selectableDimensions.length === 0
    ) {
      return null;
    }

    return (
      <Box displayInlineBlock fullWidth>
        <Spacing bottom={2} />
        {selectableDimensions.map((dim, i) => (
          <React.Fragment key={dim.id}>
            <label htmlFor={dim.id}>
              <Text textLight medium as="span">
                {dim.name || dim.id}:
              </Text>
            </label>
            <Spacing bottom={1} />
            <Select
              light
              name={dim.id}
              id={dim.id}
              value={
                typeof dim.selectedId === "undefined"
                  ? "__undefined__"
                  : dim.selectedId
              }
              onChange={this.setDimensionValue.bind(this, dim)}
            >
              {/* If no value as been selected -> add option */}
              {(typeof dim.selectedId === "undefined" ||
                dim.allowUndefined) && (
                <option key="__undefined__" value="">
                  Not specified
                </option>
              )}
              {dim.options.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name || option.id}
                </option>
              ))}
            </Select>
            {i < selectableDimensions.length - 1 && <Spacing bottom={2} />}
          </React.Fragment>
        ))}
      </Box>
    );
  }
}
