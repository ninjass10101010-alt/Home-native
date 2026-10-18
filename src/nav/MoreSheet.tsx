import React from "react";
import { Text, View } from "react-native";
import { Modal } from "../ui/Modal";
import { ListRow } from "../ui/ListRow";
import { NavIcon } from "../ui/NavIcon";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { NAV_ICONS } from "./CapsuleDock";
import { NavRole, moreNavItemsForRole, resolveRoute } from "./nav-items";

export interface MoreSheetProps {
  visible: boolean;
  onClose: () => void;
  role: NavRole;
  onNavigate: (path: string) => void;
  testID?: string;
}

/** The Home "More…" sheet: the manifest's secondary items for the role,
 *  as ListRows with their one-line blurbs. Counts per role: 8/7/4. */
export function MoreSheet({ visible, onClose, role, onNavigate, testID }: MoreSheetProps) {
  const { colors, accentColor } = useTheme();
  const items = moreNavItemsForRole(role);
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="More…"
      description="Everything else around the house"
      testID={testID}
    >
      <View style={{ gap: 10 }}>
        {items.map((item) => (
          <ListRow
            key={item.path}
            testID={`more-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            leading={
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: mix(accentColor, "transparent", 15),
                }}
              >
                <NavIcon iconKey={item.iconKey} size={22} color={colors["color-text-primary"]} />
                <Text style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}>
                  {NAV_ICONS[item.iconKey]}
                </Text>
              </View>
            }
            title={item.label}
            subtitle={item.description}
            showDisclosure
            onPress={() => {
              onClose();
              // resolveRoute: a Wave-2 destination lands on the honest /soon
              // placeholder instead of expo-router's Unmatched (dead) view.
              onNavigate(resolveRoute(item.path, item.label));
            }}
          />
        ))}
      </View>
    </Modal>
  );
}

export default MoreSheet;
