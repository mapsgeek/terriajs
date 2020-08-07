import i18next from "i18next";
import { computed, observable, runInAction, isObservableArray } from "mobx";
import combine from "terriajs-cesium/Source/Core/combine";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import containsAny from "../Core/containsAny";
import isDefined from "../Core/isDefined";
import isReadOnlyArray from "../Core/isReadOnlyArray";
import loadText from "../Core/loadText";
import TerriaError from "../Core/TerriaError";
import AsyncMappableMixin from "../ModelMixins/AsyncMappableMixin";
import CatalogMemberMixin from "../ModelMixins/CatalogMemberMixin";
import GetCapabilitiesMixin from "../ModelMixins/GetCapabilitiesMixin";
import UrlMixin from "../ModelMixins/UrlMixin";
import xml2json from "../ThirdParty/xml2json";
import {
  InfoSectionTraits,
  ShortReportTraits
} from "../Traits/CatalogMemberTraits";
import { RectangleTraits } from "../Traits/MappableTraits";
import WebFeatureServiceCatalogItemTraits from "../Traits/WebFeatureServiceCatalogItemTraits";
import CommonStrata from "./CommonStrata";
import CreateModel from "./CreateModel";
import createStratumInstance from "./createStratumInstance";
import ExportableData from "./ExportableData";
import GeoJsonCatalogItem from "./GeoJsonCatalogItem";
import LoadableStratum from "./LoadableStratum";
import Mappable from "./Mappable";
import { BaseModel } from "./Model";
import proxyCatalogItemUrl from "./proxyCatalogItemUrl";
import StratumFromTraits from "./StratumFromTraits";
import WebFeatureServiceCapabilities, {
  FeatureType,
  getRectangleFromLayer
} from "./WebFeatureServiceCapabilities";

class GetCapabilitiesStratum extends LoadableStratum(
  WebFeatureServiceCatalogItemTraits
) {
  static load(
    catalogItem: WebFeatureServiceCatalogItem
  ): Promise<GetCapabilitiesStratum> {
    if (catalogItem.getCapabilitiesUrl === undefined) {
      return Promise.reject(
        new TerriaError({
          sender: this,
          title: i18next.t(
            "models.webFeatureServiceCatalogItem.missingUrlTitle",
            this
          ),
          message: i18next.t(
            "models.webFeatureServiceCatalogItem.missingUrlMessage",
            this
          )
        })
      );
    }

    const proxiedUrl = proxyCatalogItemUrl(
      catalogItem,
      catalogItem.getCapabilitiesUrl,
      catalogItem.getCapabilitiesCacheDuration
    );
    return WebFeatureServiceCapabilities.fromUrl(proxiedUrl).then(
      capabilities => {
        return new GetCapabilitiesStratum(catalogItem, capabilities);
      }
    );
  }

  constructor(
    readonly catalogItem: WebFeatureServiceCatalogItem,
    readonly capabilities: WebFeatureServiceCapabilities
  ) {
    super();
  }

  duplicateLoadableStratum(model: BaseModel): this {
    return new GetCapabilitiesStratum(
      model as WebFeatureServiceCatalogItem,
      this.capabilities
    ) as this;
  }

  @computed
  get capabilitiesFeatureTypes(): ReadonlyMap<string, FeatureType | undefined> {
    const lookup: (
      name: string
    ) => [string, FeatureType | undefined] = name => [
      name,
      this.capabilities && this.capabilities.findLayer(name)
    ];
    return new Map(this.catalogItem.typeNamesArray.map(lookup));
  }

  @computed
  get info(): StratumFromTraits<InfoSectionTraits>[] {
    const result: StratumFromTraits<InfoSectionTraits>[] = [];

    function createInfoSection(name: string, content: string | undefined) {
      const trait = createStratumInstance(InfoSectionTraits);
      trait.name = name;
      trait.content = content;
      return trait;
    }

    result.push(
      createInfoSection(
        i18next.t("models.webFeatureServiceCatalogItem.getCapabilitiesUrl"),
        this.catalogItem.getCapabilitiesUrl
      )
    );

    let firstDataDescription: string | undefined;
    for (const layer of this.capabilitiesFeatureTypes.values()) {
      if (
        !layer ||
        !layer.Abstract ||
        containsAny(
          layer.Abstract,
          WebFeatureServiceCatalogItem.abstractsToIgnore
        )
      ) {
        continue;
      }

      const suffix =
        this.capabilitiesFeatureTypes.size === 1 ? "" : ` - ${layer.Title}`;
      const name = `${i18next.t(
        "models.webFeatureServiceCatalogItem.abstract"
      )}${suffix}`;

      result.push(createInfoSection(name, layer.Abstract));

      firstDataDescription = firstDataDescription || layer.Abstract;
    }

    // Show the service abstract if there is one and if it isn't the Geoserver default "A compliant implementation..."
    const service = this.capabilities && this.capabilities.Service;
    if (service) {
      if (
        service &&
        service.Abstract &&
        !containsAny(
          service.Abstract,
          WebFeatureServiceCatalogItem.abstractsToIgnore
        ) &&
        service.Abstract !== firstDataDescription
      ) {
        result.push(
          createInfoSection(
            i18next.t("models.webFeatureServiceCatalogItem.abstract"),
            service.Abstract
          )
        );
      }

      // Show the Access Constraints if it isn't "none" (because that's the default, and usually a lie).
      if (
        service.AccessConstraints &&
        !/^none$/i.test(service.AccessConstraints)
      ) {
        result.push(
          createInfoSection(
            i18next.t("models.webFeatureServiceCatalogItem.accessConstraints"),
            service.AccessConstraints
          )
        );
      }
    }
    return result;
  }

  @computed
  get infoSectionOrder(): string[] {
    let layerDescriptions = [
      i18next.t("models.webFeatureServiceCatalogItem.abstract")
    ];

    // If more than one layer, push layer description titles for each applicable layer
    if (this.capabilitiesFeatureTypes.size > 1) {
      layerDescriptions = [];
      this.capabilitiesFeatureTypes.forEach(layer => {
        if (
          layer &&
          layer.Abstract &&
          !containsAny(
            layer.Abstract,
            WebFeatureServiceCatalogItem.abstractsToIgnore
          )
        ) {
          layerDescriptions.push(
            `${i18next.t("models.webFeatureServiceCatalogItem.abstract")} - ${
              layer.Title
            }`
          );
        }
      });
    }

    return [
      i18next.t("preview.disclaimer"),
      i18next.t("description.name"),
      ...layerDescriptions,
      i18next.t("preview.datasetDescription"),
      i18next.t("preview.serviceDescription"),
      i18next.t("models.webFeatureServiceCatalogItem.serviceDescription"),
      i18next.t("preview.resourceDescription"),
      i18next.t("preview.licence"),
      i18next.t("preview.accessConstraints"),
      i18next.t("models.webFeatureServiceCatalogItem.accessConstraints"),
      i18next.t("preview.author"),
      i18next.t("preview.contact"),
      i18next.t("models.webFeatureServiceCatalogItem.serviceContact"),
      i18next.t("preview.created"),
      i18next.t("preview.modified"),
      i18next.t("preview.updateFrequency"),
      i18next.t("models.webFeatureServiceCatalogItem.getCapabilitiesUrl")
    ];
  }

  @computed
  get rectangle(): StratumFromTraits<RectangleTraits> | undefined {
    const layers: FeatureType[] = [
      ...this.capabilitiesFeatureTypes.values()
    ].filter(isDefined);

    // Only return first layer's rectangle - as we don't support multiple WFS layers
    return layers.length > 0 ? getRectangleFromLayer(layers[0]) : undefined;
  }

  @computed
  get isGeoServer(): boolean | undefined {
    if (!this.capabilities) {
      return undefined;
    }

    if (
      !this.capabilities.Service ||
      !this.capabilities.Service.KeywordList ||
      !this.capabilities.Service.KeywordList.Keyword
    ) {
      return false;
    }

    const keyword = this.capabilities.Service.KeywordList.Keyword;
    if (isReadOnlyArray(keyword)) {
      return keyword.indexOf("GEOSERVER") >= 0;
    } else {
      return keyword === "GEOSERVER";
    }
  }

  @computed
  get outputFormats(): string[] {
    return (
      this.capabilities.json.OperationsMetadata?.Operation?.find(
        (op: any) => op.name === "GetFeature"
      )?.Parameter?.find((p: any) => p.name === "outputFormat")?.Value || []
    );
  }
}

class WebFeatureServiceCatalogItem
  extends AsyncMappableMixin(
    GetCapabilitiesMixin(
      UrlMixin(
        CatalogMemberMixin(CreateModel(WebFeatureServiceCatalogItemTraits))
      )
    )
  )
  implements Mappable, ExportableData {
  /**
   * The collection of strings that indicate an Abstract property should be ignored.  If these strings occur anywhere
   * in the Abstract, the Abstract will not be used.  This makes it easy to filter out placeholder data like
   * Geoserver's "A compliant implementation of WFS..." stock abstract.
   */
  static abstractsToIgnore = [
    "A compliant implementation of WFS",
    "This is the reference implementation of WFS 1.0.0 and WFS 1.1.0, supports all WFS operations including Transaction."
  ];

  // hide elements in the info section which might show information about the datasource
  _sourceInfoItemNames = [
    i18next.t("models.webFeatureServiceCatalogItem.getCapabilitiesUrl")
  ];

  static readonly type = "wfs";
  readonly canZoomTo = true;

  @observable
  private geojsonCatalogItem: GeoJsonCatalogItem | undefined;

  get type() {
    return WebFeatureServiceCatalogItem.type;
  }

  protected get defaultGetCapabilitiesUrl(): string | undefined {
    if (this.uri) {
      return this.uri
        .clone()
        .setSearch({
          service: "WFS",
          version: "1.1.0",
          request: "GetCapabilities"
        })
        .toString();
    } else {
      return undefined;
    }
  }

  protected forceLoadMetadata(): Promise<void> {
    return GetCapabilitiesStratum.load(this).then(stratum => {
      runInAction(() => {
        this.strata.set(
          GetCapabilitiesMixin.getCapabilitiesStratumName,
          stratum
        );
      });
    });
  }

  async forceLoadMapItems(): Promise<void> {
    await this.loadMetadata();
    const getCapabilitiesStratum:
      | GetCapabilitiesStratum
      | undefined = this.strata.get(
      GetCapabilitiesMixin.getCapabilitiesStratumName
    ) as GetCapabilitiesStratum;

    if (!this.uri) {
      throw new TerriaError({
        sender: this,
        title: i18next.t("models.webFeatureServiceCatalogItem.missingUrlTitle"),
        message: i18next.t(
          "models.webFeatureServiceCatalogItem.missingUrlMessage",
          this
        )
      });
    }

    // Check if layers exist
    const missingLayers = this.typeNamesArray.filter(
      layer => !getCapabilitiesStratum.capabilitiesFeatureTypes.has(layer)
    );
    if (missingLayers.length > 0) {
      throw new TerriaError({
        sender: this,
        title: i18next.t(
          "models.webFeatureServiceCatalogItem.noLayerFoundTitle"
        ),
        message: i18next.t(
          "models.webFeatureServiceCatalogItem.noLayerFoundMessage",
          this
        )
      });
    }

    // Check if geojson output is supported
    if (
      !isDefined(
        getCapabilitiesStratum.outputFormats.find(format =>
          ["json", "JSON", "application/json"].includes(format)
        )
      )
    ) {
      throw new TerriaError({
        sender: this,
        title: i18next.t(
          "models.webFeatureServiceCatalogItem.unsupportedGeojsonOutputTitle"
        ),
        message: i18next.t(
          "models.webFeatureServiceCatalogItem.unsupportedGeojsonOutputMessage",
          this
        )
      });
    }

    const url = this.uri
      .clone()
      .setSearch(
        combine(
          {
            service: "WFS",
            request: "GetFeature",
            typeName: this.typeNames,
            version: "1.1.0",
            outputFormat: "JSON",
            srsName: "EPSG:4326",
            maxFeatures: this.maxFeatures
          },
          this.parameters
        )
      )
      .toString();

    const getFeatureResponse = await loadText(proxyCatalogItemUrl(this, url));

    // If request returns XML, try to find error message
    if (getFeatureResponse.startsWith("<")) {
      try {
        const error = xml2json(getFeatureResponse);

        throw new TerriaError({
          sender: this,
          title: i18next.t(
            "models.webFeatureServiceCatalogItem.missingDataTitle"
          ),
          message: `${i18next.t(
            "models.webFeatureServiceCatalogItem.missingDataMessage",
            this
          )} <br/>Error: ${error.ExceptionReport?.Exception?.ExceptionText ||
            error.toString()}`
        });
      } catch (e) {
        console.log(getFeatureResponse);
        throw new TerriaError({
          sender: this,
          title: i18next.t(
            "models.webFeatureServiceCatalogItem.missingDataTitle"
          ),
          message: `${i18next.t(
            "models.webFeatureServiceCatalogItem.missingDataMessage",
            this
          )}`
        });
      }
    }

    runInAction(() => {
      this.geojsonCatalogItem = new GeoJsonCatalogItem(
        createGuid(),
        this.terria
      );

      this.geojsonCatalogItem.setTrait(
        CommonStrata.definition,
        "geoJsonData",
        JSON.parse(getFeatureResponse)
      );

      if (isDefined(this.style))
        this.geojsonCatalogItem.setTrait(
          CommonStrata.definition,
          "style",
          this.style
        );
    });

    await this.geojsonCatalogItem!.loadMapItems();
  }

  @computed
  get typeNamesArray(): ReadonlyArray<string> {
    if (Array.isArray(this.typeNames)) {
      return this.typeNames;
    } else if (this.typeNames) {
      return this.typeNames.split(",");
    } else {
      return [];
    }
  }

  @computed
  get canExportData() {
    return isDefined(this.geojsonCatalogItem?.geoJsonData);
  }

  async exportData() {
    if (isDefined(this.geojsonCatalogItem?.geoJsonData)) {
      return {
        name: `${this.name} export.json`,
        file: new Blob([JSON.stringify(this.geojsonCatalogItem!.geoJsonData)])
      };
    }
    return;
  }

  @computed
  get mapItems() {
    if (this.geojsonCatalogItem) {
      return this.geojsonCatalogItem.mapItems;
    }
    return [];
  }

  @computed
  get shortReport() {
    // Show notice if reached
    if (
      isObservableArray(this.geojsonCatalogItem?.geoJsonData?.features) &&
      this.geojsonCatalogItem!.geoJsonData!.features.length >= this.maxFeatures
    ) {
      return i18next.t(
        "models.webFeatureServiceCatalogItem.reachedMaxFeatureLimit",
        this
      );
    }
    return undefined;
  }
}

export default WebFeatureServiceCatalogItem;
