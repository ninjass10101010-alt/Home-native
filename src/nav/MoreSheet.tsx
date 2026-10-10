import React from "react";
import { Text, View } from "react-native";
import { Modal } from "../ui/Modal";
import { ListRow } from "../ui/ListRow";
import { NAV_ICONS } from "./CapsuleDock";
import { NavRole, moreNavItemsForRole } from "./nav-items";

export interface MoreSheetProps {
  visible: boolean;
  onClose: () => void;
  role: NavRole;
  onNavigate: (path: string) => void;
  testID?: string;
}

/** The Home "More…" sheet: the manifest's secondary items for the role,
 *  as ListRows with their one-line blurbs. Counts per role: 7/6/4. */
export function MoreSheet({ visible, onClose, role, onNavigate, testID }: MoreSheetProps) {
  const items = moreNavItemsForRole(role);
  return (
    <Modal visible={visible} onClose={onClose} title="More…" testID={testID}>
      <View style={{ gap: 10 }}>
        {items.map((item) => (
          <ListRow
            key={item.path}
            testID={`more-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            leading={<Text style={{ fontSize: 24 }}>{NAV_ICONS[item.iconKey]}</Text>}
            title={item.label}
            subtitle={item.description}
            showDisclosure
            onPress={() => {
              onClose();
              onNavigate(item.path);
            }}
          />
        ))}
      </View>
    </Modal>
  );
}

export default MoreSheet;
